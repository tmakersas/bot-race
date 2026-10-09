import { Redis } from "@upstash/redis";
import { createHash, randomBytes } from "node:crypto";
import type { Board, FeedItem, Hit, LaneId, Me, Race } from "./lanes";
export type { Me } from "./lanes";

// Upstash Redis when the env is set, an in-memory fallback for local dev.
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const redis = url && token ? new Redis({ url, token }) : null;

const TTL = 60 * 60 * 24 * 45; // races live 45 days
export const MAX_STORED = 3000; // per race, after that only lane counters move

const kRace = (id: string) => `bot-race:race:${id}`;
const kHits = (id: string) => `bot-race:hits:${id}`;
const kLanes = (id: string) => `bot-race:lanes:${id}`;
const K_FAST = "bot-race:fastest";
const K_FAST_RACE = "bot-race:fastest-race";
const K_RACES = "bot-race:races";
const kClaims = (id: string) => `bot-race:claims:${id}`;
const K_FEED = "bot-race:feed"; // last runners of every race, newest first
const K_HUMANS = "bot-race:humans"; // fastest claimed humans: "handle|race" -> ms after the gun
const K_MAGNET = "bot-race:magnet"; // race -> bots in the first 10 minutes (races with a tweet)
const kDay = (d: string) => `bot-race:day:${d}`;
const kMe = (id: string) => `bot-race:me:${id}`; // arrival time -> a browser runner's result, kept even past MAX_STORED

 // runners/bots/humans across every race that day
export const MAGNET_WINDOW = 10 * 60_000;
export const CLAIM_WINDOW = 30 * 60_000;

/** Today's homepage race: every visit to tmaker.io/bot-race is a runner, clock from midnight UTC. */
export function houseId(t = Date.now()): string {
  return "d" + new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
}
export const isHouse = (id: string) => /^d\d{8}$/.test(id);
export function dayStart(t = Date.now()): number {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10).replace(/-/g, "");

type Mem = { race: Record<string, string | number | null>; hits: Hit[]; lanes: Record<string, number>; claims: Record<string, string> };
const g = globalThis as unknown as {
  __br?: Map<string, Mem>;
  __brFast?: Map<string, number>;
  __brFeed?: FeedItem[];
  __brHumans?: Map<string, number>;
  __brMagnet?: Map<string, number>;
  __brDay?: Map<string, Record<string, number>>;
  __brMe?: Map<string, Me>;
};
const mem = (g.__br ??= new Map());
const memFast = (g.__brFast ??= new Map());
const memFeed = (g.__brFeed ??= []);
const memHumans = (g.__brHumans ??= new Map());
const memMagnet = (g.__brMagnet ??= new Map());
const memDay = (g.__brDay ??= new Map());
const memMe = (g.__brMe ??= new Map());

export const hashKey = (k: string) => createHash("sha256").update(k).digest("hex").slice(0, 32);

export function newId(n = 7) {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  const b = randomBytes(n);
  return Array.from(b, (x) => abc[x % abc.length]).join("");
}

export async function createRace(label: string | null): Promise<{ id: string; key: string }> {
  const id = newId();
  const key = randomBytes(12).toString("base64url");
  const race = { created: Date.now(), t0: "", tweet: "", label: label || "", key: hashKey(key), count: 0 };
  if (!redis) {
    mem.set(id, { race: { ...race }, hits: [], lanes: {}, claims: {} });
  } else {
    const p = redis.pipeline();
    p.hset(kRace(id), race);
    p.expire(kRace(id), TTL);
    p.zadd(K_RACES, { score: race.created, member: id });
    await p.exec();
  }
  return { id, key };
}

/** Make sure today's homepage race exists. Cheap: HSETNX, so racing visitors cannot clobber it. */
export async function ensureHouse(id: string) {
  if (!isHouse(id)) return;
  const y = Number(id.slice(1, 5)), m = Number(id.slice(5, 7)) - 1, d = Number(id.slice(7, 9));
  const t0 = Date.UTC(y, m, d);
  if (!redis) {
    if (!mem.has(id)) mem.set(id, { race: { created: t0, t0, tweet: "", label: "Today on Bot Race", key: "", count: 0, house: 1 }, hits: [], lanes: {}, claims: {} });
    return;
  }
  const exists = await redis.exists(kRace(id));
  if (exists) return;
  const p = redis.pipeline();
  p.hsetnx(kRace(id), "created", t0);
  p.hsetnx(kRace(id), "t0", t0);
  p.hsetnx(kRace(id), "label", "Today on Bot Race");
  p.hsetnx(kRace(id), "house", 1);
  p.hsetnx(kRace(id), "count", 0);
  p.expire(kRace(id), 60 * 60 * 24 * 8);
  await p.exec();
}

export async function getRaceRaw(id: string): Promise<Record<string, string | number | null> | null> {
  if (!/^[a-z0-9]{5,12}$/.test(id)) return null;
  if (!redis) return mem.get(id)?.race ?? null;
  const r = await redis.hgetall<Record<string, string | number | null>>(kRace(id));
  return r && Object.keys(r).length ? r : null;
}

function toRace(id: string, r: Record<string, string | number | null>, lanes: Record<string, number> | null, claims: Record<string, string> | null = null): Race {
  const lanesClean: Partial<Record<LaneId, number>> = {};
  for (const [k, v] of Object.entries(lanes || {})) lanesClean[k as LaneId] = Number(v);
  return {
    id,
    created: Number(r.created),
    t0: r.t0 ? Number(r.t0) : null,
    tweet: r.tweet ? String(r.tweet) : null,
    label: r.label ? String(r.label) : null,
    count: Number(r.count || 0),
    lanes: lanesClean,
    house: isHouse(id),
    owner: r.owner ? String(r.owner) : null,
    claims: claims || {},
  };
}

export async function getRace(id: string): Promise<Race | null> {
  const r = await getRaceRaw(id);
  if (!r) return null;
  if (!redis) return toRace(id, r, mem.get(id)!.lanes, mem.get(id)!.claims);
  const [lanes, claims] = await Promise.all([redis.hgetall<Record<string, number>>(kLanes(id)), redis.hgetall<Record<string, string>>(kClaims(id))]);
  return toRace(id, r, lanes, claims);
}

export async function getHits(id: string, from: number, to: number): Promise<Hit[]> {
  if (!redis) return mem.get(id)?.hits.slice(from, to + 1) ?? [];
  return (await redis.lrange<Hit>(kHits(id), from, to)) || [];
}

/** Reserve an arrival number. Returns null when the race does not exist. */
export type Seq = { s: number; t0: number | null; owner: string | null; label: string | null };

export async function reserveSeq(id: string): Promise<Seq | null> {
  if (!redis) {
    const m = mem.get(id);
    if (!m) return null;
    m.race.count = Number(m.race.count) + 1;
    return { s: Number(m.race.count), t0: m.race.t0 ? Number(m.race.t0) : null, owner: m.race.owner ? String(m.race.owner) : null, label: m.race.label ? String(m.race.label) : null };
  }
  const r = await redis.hmget<{ created: string | null; t0: string | null; owner: string | null; label: string | null }>(kRace(id), "created", "t0", "owner", "label");
  if (!r?.created) return null;
  const s = await redis.hincrby(kRace(id), "count", 1);
  return { s, t0: r.t0 ? Number(r.t0) : null, owner: r.owner ? String(r.owner) : null, label: r.label ? String(r.label) : null };
}

export async function saveHit(id: string, hit: Hit, seq: Seq) {
  const house = isHouse(id);
  const t0 = seq.t0;
  const feed: FeedItem = { r: id, who: seq.owner || "", house: house ? 1 : 0, l: hit.l, n: hit.n, o: hit.o, d: t0 && !house ? hit.t - t0 : null, t: hit.t };
  const day = dayKey(hit.t);
  const isBot = hit.l !== "human";
  const magnet = !house && seq.owner && t0 && isBot && hit.l !== "x" && hit.t >= t0 && hit.t - t0 <= MAGNET_WINDOW;
  const browser = hit.l === "human" || hit.l === "ghost";
  if (!redis) {
    const m = mem.get(id);
    if (!m) return;
    if (browser) {
      const beat = Object.entries(m.lanes).reduce((a, [k, v]) => a + (k === "human" ? 0 : Number(v)), 0);
      memMe.set(`${id}:${hit.t}`, { s: hit.s, t: hit.t, l: hit.l, n: hit.n, beat, place: hit.l === "human" ? (m.lanes.human || 0) + 1 : 0 });
    }
    if (m.hits.length < MAX_STORED) m.hits.push(hit);
    m.lanes[hit.l] = (m.lanes[hit.l] || 0) + 1;
    memFeed.unshift(feed);
    memFeed.length = Math.min(memFeed.length, 100);
    const dd = memDay.get(day) || {};
    dd.runners = (dd.runners || 0) + 1;
    dd[isBot ? "bots" : "humans"] = (dd[isBot ? "bots" : "humans"] || 0) + 1;
    memDay.set(day, dd);
    if (magnet) memMagnet.set(id, (memMagnet.get(id) || 0) + 1);
    if (t0 && !house) recordFastest(hit, t0, id);
    return;
  }
  const p = redis.pipeline();
  let counted = false;
  if (browser) {
    const lanes = (await redis.hgetall<Record<string, number>>(kLanes(id))) || {};
    const beat = Object.entries(lanes).reduce((a, [k, v]) => a + (k === "human" ? 0 : Number(v)), 0);
    // Atomic, so two humans a millisecond apart can never both be first.
    const place = hit.l === "human" ? await redis.hincrby(kLanes(id), "human", 1) : 0;
    counted = hit.l === "human";
    const me: Me = { s: hit.s, t: hit.t, l: hit.l, n: hit.n, beat, place };
    p.hset(kMe(id), { [String(hit.t)]: JSON.stringify(me) });
    p.expire(kMe(id), house ? 60 * 60 * 24 * 8 : TTL);
  }
  if (hit.s <= MAX_STORED) p.rpush(kHits(id), JSON.stringify(hit));
  if (!counted) p.hincrby(kLanes(id), hit.l, 1);
  p.expire(kHits(id), house ? 60 * 60 * 24 * 8 : TTL);
  p.expire(kLanes(id), house ? 60 * 60 * 24 * 8 : TTL);
  p.lpush(K_FEED, JSON.stringify(feed));
  p.ltrim(K_FEED, 0, 99);
  p.hincrby(kDay(day), "runners", 1);
  p.hincrby(kDay(day), isBot ? "bots" : "humans", 1);
  p.expire(kDay(day), 60 * 60 * 24 * 40);
  if (magnet) p.zincrby(K_MAGNET, 1, id);
  await p.exec();
  if (t0 && !house) await recordFastest(hit, t0, id);
}

/** All-time fastest reaction per bot family, only for races with a real tweet time. */
async function recordFastest(hit: Hit, t0: number, id: string) {
  if (hit.l === "human" || hit.l === "x") return;
  const ms = hit.t - t0;
  if (ms < 0) return;
  const member = `${hit.l}|${hit.n}`;
  if (!redis) {
    const cur = memFast.get(member);
    if (cur === undefined || ms < cur) memFast.set(member, ms);
    return;
  }
  const changed = await redis.zadd(K_FAST, { lt: true, ch: true }, { score: ms, member });
  if (changed) await redis.hset(K_FAST_RACE, { [member]: id });
}

export async function getFastest(n = 12): Promise<{ lane: LaneId; name: string; ms: number; race?: string }[]> {
  if (!redis) {
    return [...memFast.entries()]
      .sort((a, b) => a[1] - b[1])
      .slice(0, n)
      .map(([m, ms]) => ({ lane: m.split("|")[0] as LaneId, name: m.split("|").slice(1).join("|"), ms }));
  }
  const rows = await redis.zrange<(string | number)[]>(K_FAST, 0, n - 1, { withScores: true });
  const out: { lane: LaneId; name: string; ms: number; race?: string }[] = [];
  for (let i = 0; i < rows.length; i += 2) {
    const m = String(rows[i]);
    out.push({ lane: m.split("|")[0] as LaneId, name: m.split("|").slice(1).join("|"), ms: Number(rows[i + 1]) });
  }
  if (out.length) {
    const races = await redis.hmget<Record<string, string>>(K_FAST_RACE, ...out.map((o) => `${o.lane}|${o.name}`));
    for (const o of out) o.race = races?.[`${o.lane}|${o.name}`] || undefined;
  }
  return out;
}

export async function countRaces(): Promise<number> {
  if (!redis) return mem.size;
  return (await redis.zcard(K_RACES)) || 0;
}

export async function setStart(id: string, key: string, t0: number, tweet: string, owner: string | null = null): Promise<"ok" | "nokey" | "missing"> {
  const r = await getRaceRaw(id);
  if (!r) return "missing";
  if (String(r.key) !== hashKey(key)) return "nokey";
  if (!redis) {
    const m = mem.get(id)!;
    m.race.t0 = t0;
    m.race.tweet = tweet;
    if (owner) m.race.owner = owner;
    for (const h of m.hits) recordFastest(h, t0, id);
    for (const [sq, handle] of Object.entries(m.claims)) {
      const h = m.hits.find((x: Hit) => String(x.s) === sq);
      if (h && h.t >= t0) memHumans.set(`${handle}|${id}`, h.t - t0);
      else memHumans.delete(`${handle}|${id}`);
    }
    if (owner) memMagnet.set(id, m.hits.filter((h: Hit) => h.l !== "human" && h.l !== "x" && h.t >= t0 && h.t - t0 <= MAGNET_WINDOW).length);
    return "ok";
  }
  await redis.hset(kRace(id), owner ? { t0, tweet, owner } : { t0, tweet });
  // Backfill the all-time board with hits that already arrived.
  const hits = await getHits(id, 0, MAX_STORED);
  const best = new Map<string, Hit>();
  for (const h of hits) {
    if (h.l === "human" || h.l === "x" || h.t < t0) continue;
    const k = `${h.l}|${h.n}`;
    const cur = best.get(k);
    if (!cur || h.t < cur.t) best.set(k, h);
  }
  for (const h of best.values()) await recordFastest(h, t0, id);
  if (owner) {
    const n = hits.filter((h) => h.l !== "human" && h.l !== "x" && h.t >= t0 && h.t - t0 <= MAGNET_WINDOW).length;
    await redis.zadd(K_MAGNET, { score: n, member: id });
  }
  // Claimed humans were timed from X's first visit; re-time them from the tweet.
  const claims = (await redis.hgetall<Record<string, string>>(kClaims(id))) || {};
  for (const [sq, handle] of Object.entries(claims)) {
    const h = hits.find((x) => String(x.s) === sq);
    if (!h) continue;
    const ms = h.t - t0;
    if (ms >= 0) await redis.zadd(K_HUMANS, { score: ms, member: `${handle}|${id}` });
    else await redis.zrem(K_HUMANS, `${handle}|${id}`);
  }
  return "ok";
}

/** Where the clock starts: the tweet time, else X's first visit, else the first runner. */
export function originOf(race: { t0: number | null; created: number }, hits: Hit[]): number {
  if (race.t0) return race.t0;
  const sorted = [...hits].sort((a, b) => a.t - b.t);
  return sorted.find((h) => h.l === "x")?.t ?? sorted[0]?.t ?? race.created;
}

export async function getMe(id: string, t: number): Promise<Me | null> {
  if (!redis) return memMe.get(`${id}:${t}`) ?? null;
  const raw = await redis.hget<Me | string>(kMe(id), String(t));
  if (!raw) return null;
  return typeof raw === "string" ? (JSON.parse(raw) as Me) : raw;
}

export type ClaimResult =
  | { ok: true; handle: string; place: number; ms: number | null; beat: number; firstHuman: boolean }
  | { ok: false; error: string; status: number };

/** A human runner puts their X handle on their own arrival. */
export async function claimRunner(id: string, t: number, handle: string): Promise<ClaimResult> {
  const race = await getRace(id);
  if (!race) return { ok: false, error: "No such race", status: 404 };
  if (Date.now() - t > CLAIM_WINDOW) return { ok: false, error: "Claims close 30 minutes after you cross the line.", status: 400 };
  const me = await getMe(id, t);
  if (!me) return { ok: false, error: "Still timing you. Try again in a second.", status: 409 };
  if (me.l !== "human") return { ok: false, error: "Our judges have you down as a bot. Only humans go on the board.", status: 403 };
  const hits = race.house ? [] : await getHits(id, 0, MAX_STORED);
  const claims = race.claims || {};
  if (claims[String(me.s)]) return { ok: false, error: `This spot is already claimed by @${claims[String(me.s)]}.`, status: 409 };
  if (Object.values(claims).some((c) => c.toLowerCase() === handle.toLowerCase())) return { ok: false, error: `@${handle} is already on this race.`, status: 409 };
  const origin = originOf(race, hits);
  const { place, beat } = me;
  const ms = race.house ? null : me.t - origin;
  if (!redis) {
    mem.get(id)!.claims[String(me.s)] = handle;
    if (ms !== null && ms >= 0) memHumans.set(`${handle}|${id}`, ms);
  } else {
    const ok = await redis.hsetnx(kClaims(id), String(me.s), handle);
    if (!ok) return { ok: false, error: "Someone just claimed this spot.", status: 409 };
    await redis.expire(kClaims(id), race.house ? 60 * 60 * 24 * 8 : TTL);
    if (ms !== null && ms >= 0) await redis.zadd(K_HUMANS, { score: ms, member: `${handle}|${id}` });
  }
  return { ok: true, handle, place, ms, beat, firstHuman: place === 1 };
}

export async function getFeed(n = 40): Promise<FeedItem[]> {
  if (!redis) return memFeed.slice(0, n);
  return (await redis.lrange<FeedItem>(K_FEED, 0, n - 1)) || [];
}

export async function getDay(t = Date.now()): Promise<{ runners: number; bots: number; humans: number }> {
  const raw = redis ? await redis.hgetall<Record<string, number>>(kDay(dayKey(t))) : memDay.get(dayKey(t));
  return { runners: Number(raw?.runners || 0), bots: Number(raw?.bots || 0), humans: Number(raw?.humans || 0) };
}

export async function getBoards(n = 10): Promise<Board> {
  const bots = await getFastest(n);
  let humans: Board["humans"] = [];
  let magnets: Board["magnets"] = [];
  if (!redis) {
    humans = [...memHumans.entries()].sort((a, b) => a[1] - b[1]).slice(0, n).map(([m, ms]) => ({ handle: m.split("|")[0], race: m.split("|")[1], ms }));
    magnets = [...memMagnet.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([race, b]) => ({ race, owner: String(mem.get(race)?.race.owner || ""), bots: b }));
  } else {
    const [hr, mr] = await Promise.all([
      redis.zrange<(string | number)[]>(K_HUMANS, 0, n - 1, { withScores: true }),
      redis.zrange<(string | number)[]>(K_MAGNET, 0, n - 1, { rev: true, withScores: true }),
    ]);
    for (let i = 0; i < hr.length; i += 2) {
      const m = String(hr[i]);
      humans.push({ handle: m.split("|")[0], race: m.split("|")[1], ms: Number(hr[i + 1]) });
    }
    const ids: string[] = [];
    for (let i = 0; i < mr.length; i += 2) ids.push(String(mr[i]));
    const owners = await Promise.all(ids.map((id) => redis!.hget<string>(kRace(id), "owner")));
    for (let i = 0; i < mr.length; i += 2) {
      const o = owners[i / 2];
      if (o) magnets.push({ race: String(mr[i]), owner: String(o), bots: Number(mr[i + 1]) });
    }
    const hOwners = await Promise.all(humans.map((h) => redis!.hget<string>(kRace(h.race), "owner")));
    humans.forEach((h, i) => (h.owner = hOwners[i] ? String(hOwners[i]) : null));
  }
  return { humans, magnets: magnets.filter((m) => m.bots > 0), bots };
}

export async function rateLimit(key: string, max: number, windowSec: number): Promise<boolean> {
  if (!redis) return true;
  const k = `bot-race:rl:${key}`;
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, windowSec);
  return n <= max;
}

export async function getFeatured(): Promise<string | null> {
  if (!redis) return null;
  return (await redis.get<string>("bot-race:featured")) || null;
}
