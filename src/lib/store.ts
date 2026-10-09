import { Redis } from "@upstash/redis";
import { createHash, randomBytes } from "node:crypto";
import type { Hit, LaneId, Race } from "./lanes";

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

type Mem = { race: Record<string, string | number | null>; hits: Hit[]; lanes: Record<string, number> };
const g = globalThis as unknown as { __br?: Map<string, Mem>; __brFast?: Map<string, number> };
const mem = (g.__br ??= new Map());
const memFast = (g.__brFast ??= new Map());

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
    mem.set(id, { race: { ...race }, hits: [], lanes: {} });
  } else {
    const p = redis.pipeline();
    p.hset(kRace(id), race);
    p.expire(kRace(id), TTL);
    p.zadd(K_RACES, { score: race.created, member: id });
    await p.exec();
  }
  return { id, key };
}

export async function getRaceRaw(id: string): Promise<Record<string, string | number | null> | null> {
  if (!/^[a-z0-9]{5,12}$/.test(id)) return null;
  if (!redis) return mem.get(id)?.race ?? null;
  const r = await redis.hgetall<Record<string, string | number | null>>(kRace(id));
  return r && Object.keys(r).length ? r : null;
}

function toRace(id: string, r: Record<string, string | number | null>, lanes: Record<string, number> | null): Race {
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
  };
}

export async function getRace(id: string): Promise<Race | null> {
  const r = await getRaceRaw(id);
  if (!r) return null;
  const lanes = redis ? await redis.hgetall<Record<string, number>>(kLanes(id)) : mem.get(id)!.lanes;
  return toRace(id, r, lanes);
}

export async function getHits(id: string, from: number, to: number): Promise<Hit[]> {
  if (!redis) return mem.get(id)?.hits.slice(from, to + 1) ?? [];
  return (await redis.lrange<Hit>(kHits(id), from, to)) || [];
}

/** Reserve an arrival number. Returns null when the race does not exist. */
export async function reserveSeq(id: string): Promise<{ s: number; t0: number | null } | null> {
  if (!redis) {
    const m = mem.get(id);
    if (!m) return null;
    m.race.count = Number(m.race.count) + 1;
    return { s: Number(m.race.count), t0: m.race.t0 ? Number(m.race.t0) : null };
  }
  const r = await redis.hmget<{ created: string | null; t0: string | null }>(kRace(id), "created", "t0");
  if (!r?.created) return null;
  const s = await redis.hincrby(kRace(id), "count", 1);
  return { s, t0: r.t0 ? Number(r.t0) : null };
}

export async function saveHit(id: string, hit: Hit, t0: number | null) {
  if (!redis) {
    const m = mem.get(id);
    if (!m) return;
    if (m.hits.length < MAX_STORED) m.hits.push(hit);
    m.lanes[hit.l] = (m.lanes[hit.l] || 0) + 1;
    if (t0) recordFastest(hit, t0, id);
    return;
  }
  const p = redis.pipeline();
  if (hit.s <= MAX_STORED) p.rpush(kHits(id), JSON.stringify(hit));
  p.hincrby(kLanes(id), hit.l, 1);
  p.expire(kHits(id), TTL);
  p.expire(kLanes(id), TTL);
  await p.exec();
  if (t0) await recordFastest(hit, t0, id);
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

export async function setStart(id: string, key: string, t0: number, tweet: string): Promise<"ok" | "nokey" | "missing"> {
  const r = await getRaceRaw(id);
  if (!r) return "missing";
  if (String(r.key) !== hashKey(key)) return "nokey";
  if (!redis) {
    const m = mem.get(id)!;
    m.race.t0 = t0;
    m.race.tweet = tweet;
    for (const h of m.hits) recordFastest(h, t0, id);
    return "ok";
  }
  await redis.hset(kRace(id), { t0, tweet });
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
  return "ok";
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
