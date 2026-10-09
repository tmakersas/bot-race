"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Track from "./Track";
import { buildCalls, type Call } from "@/lib/caller";
import { LANES, LANE_INDEX, type Hit, type LaneId, type Race } from "@/lib/lanes";
import { BASE, SITE } from "@/lib/site";
import { fmtClock, fmtSecs } from "@/lib/time";

type Props = { initial: Race; compact?: boolean; photo?: boolean };

const REPLAY_MS = 6500;

function originOf(race: Race, hits: Hit[]): { origin: number; label: string; kind: "tweet" | "x" | "first" | "created" } {
  if (race.t0) return { origin: race.t0, label: "since the tweet went live", kind: "tweet" };
  const sorted = [...hits].sort((a, b) => a.t - b.t);
  const x = sorted.find((h) => h.l === "x");
  if (x) return { origin: x.t, label: "since X first opened the link", kind: "x" };
  if (sorted[0]) return { origin: sorted[0].t, label: "since the first runner", kind: "first" };
  return { origin: race.created, label: "since the race was created", kind: "created" };
}

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

export default function RaceView({ initial, compact, photo }: Props) {
  const [race, setRace] = useState<Race>(initial);
  const [hits, setHits] = useState<Hit[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<"replay" | "live">("replay");
  const [calls, setCalls] = useState<Call[]>([]);
  const [shownCalls, setShownCalls] = useState(0);
  const [mine, setMine] = useState<number | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [hideHumans, setHideHumans] = useState(false);

  const clockRef = useRef(0);
  const clockEl = useRef<HTMLSpanElement>(null);
  const appear = useRef(new Map<number, number>()).current;
  const offset = useRef(0);
  const replayStart = useRef<number | null>(null);
  const hitsMap = useRef(new Map<number, Hit>());
  const raceRef = useRef(race);
  raceRef.current = race;

  const { origin, label: originLabel, kind } = useMemo(() => originOf(race, hits), [race, hits]);
  const sorted = useMemo(() => [...hits].sort((a, b) => a.t - b.t || a.s - b.s), [hits]);

  // Data: poll the race in 500-hit chunks; the API is CDN cached for 1s.
  const poll = useCallback(async () => {
    const have = hitsMap.current.size;
    const chunk = Math.floor(have / 500);
    const r = await fetch(`${BASE}/api/race/${initial.id}?chunk=${chunk}`, { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return;
    const d = (await r.json()) as { race: Race; hits: Hit[]; now: number };
    offset.current = d.now - Date.now();
    let added = false;
    for (const h of d.hits) {
      if (!hitsMap.current.has(h.s)) {
        hitsMap.current.set(h.s, h);
        added = true;
      }
    }
    setRace(d.race);
    if (added) setHits([...hitsMap.current.values()]);
    setLoaded(true);
    // Big race: keep pulling chunks until we are caught up.
    if (d.hits.length === 500) setTimeout(poll, 50);
  }, [initial.id]);

  useEffect(() => {
    poll();
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      const r = raceRef.current;
      const age = Date.now() - (r.t0 || r.created);
      const every = document.hidden ? 15000 : age < 15 * 60_000 ? 1000 : age < 6 * 3600_000 ? 3000 : 10000;
      t = setTimeout(async () => {
        await poll();
        loop();
      }, every);
    };
    loop();
    return () => clearTimeout(t);
  }, [poll]);

  useEffect(() => {
    const m = readCookie(`br_me_${initial.id}`);
    if (m) setMine(Number(m));
    // Owner link (?k=...): remember the key on this device, then hide it from the URL.
    const qk = new URLSearchParams(location.search).get("k");
    if (qk) {
      localStorage.setItem(`br_k_${initial.id}`, qk);
      const prev = (readCookie("br_o") || "").split(".").filter(Boolean).slice(-20);
      if (!prev.includes(initial.id)) document.cookie = `br_o=${[...prev, initial.id].join(".")}; path=${BASE}; max-age=${60 * 60 * 24 * 60}; samesite=lax`;
      history.replaceState(null, "", location.pathname);
    }
    const k = localStorage.getItem(`br_k_${initial.id}`);
    if (k) setKey(k);
  }, [initial.id]);

  useEffect(() => {
    setCalls(buildCalls(hits, origin, kind === "tweet"));
  }, [hits, origin, kind]);

  // The clock. Replays the whole race on load (log time, so the first second
  // gets as much screen time as the first hour), then goes live.
  useEffect(() => {
    if (!loaded) return;
    let raf = 0;
    const live = () => Date.now() + offset.current - origin;
    const first = sorted[0] ? Math.min(0, sorted[0].t - origin) : 0;
    if (replayStart.current === null) replayStart.current = sorted.length ? performance.now() : -1;
    const tick = () => {
      const now = performance.now();
      const L = Math.max(live(), 1000);
      let c: number;
      if (replayStart.current !== null && replayStart.current >= 0 && now - replayStart.current < REPLAY_MS) {
        const p = (now - replayStart.current) / REPLAY_MS;
        const pre = first < 0 ? 0.14 : 0;
        if (p < pre) c = first + (p / pre) * -first;
        else {
          const q = (p - pre) / (1 - pre);
          const e = q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
          c = Math.pow(10, 2 + e * (Math.log10(L) - 2)) - 100 * (1 - e);
        }
      } else {
        c = live();
        if (mode !== "live") setMode("live");
      }
      clockRef.current = c;
      for (const h of sorted) {
        if (h.t - origin <= c && !appear.has(h.s)) appear.set(h.s, now);
      }
      if (clockEl.current) clockEl.current.textContent = race.t0 || sorted.length ? fmtClock(c) : "--:--.--";
      let n = 0;
      for (const call of calls) if (call.at <= c) n++;
      setShownCalls((prev) => (prev === n ? prev : n));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loaded, origin, sorted, calls, appear, race.t0, mode]);

  const visibleCalls = calls.slice(0, shownCalls).reverse().slice(0, compact ? 2 : 5);
  const laneCounts = useMemo(() => {
    const c: Record<LaneId, number> = { x: 0, ai: 0, search: 0, seo: 0, social: 0, script: 0, ghost: 0, human: 0 };
    for (const [k, v] of Object.entries(race.lanes)) c[k as LaneId] = v || 0;
    return c;
  }, [race.lanes]);
  const total = race.count;
  const bots = total - laneCounts.human;
  const outsider = sorted.find((h) => h.t >= origin && h.l !== "x" && h.l !== "human");
  const firstAi = sorted.find((h) => h.t >= origin && h.l === "ai");
  const myHit = mine ? sorted.find((h) => Math.abs(h.t - mine) < 2) : null;
  const beatMe = myHit ? sorted.filter((h) => h.t < myHit.t && h.l !== "human").length : 0;
  const raceUrl = `${SITE}/r/${race.id}`;
  const photoUrl = `${SITE}/p/${race.id}`;

  const rows = sorted.filter((h) => !hideHumans || h.l !== "human");
  const table = rows.slice(0, showAll ? 300 : 25);

  const shareText = useMemo(() => {
    const parts = [`${bots} bots${laneCounts.human ? ` and ${laneCounts.human} humans` : ""} opened my link`];
    if (outsider && kind === "tweet") parts.push(`first outsider: ${outsider.n} at ${fmtSecs(outsider.t - origin)} after I posted`);
    parts.push(laneCounts.ai ? `${laneCounts.ai} AI crawlers in the field` : "zero AI crawlers. AI answers don't know this page exists");
    return parts.join("\n") + "\n\nphoto finish:";
  }, [bots, laneCounts, outsider, kind, origin]);

  return (
    <div className={compact ? "" : "mx-auto max-w-6xl px-4 pb-24 pt-5 sm:px-6"}>
      {!compact && (
        <header className="mb-5 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-white/55">
          <Link href="/" className="flex items-center gap-2 text-chalk">
            <span className="font-display text-lg tracking-wider">BOT RACE</span>
          </Link>
          <span className="flex items-center gap-2">
            <span className={`live-dot inline-block h-2 w-2 rounded-full ${mode === "live" ? "bg-flag" : "bg-hype"}`} />
            {mode === "live" ? "live" : "replay"} · race {race.id}
          </span>
        </header>
      )}

      <section className={`relative overflow-hidden rounded-2xl border border-white/10 bg-turf ${compact ? "" : "shadow-[0_0_80px_-20px_rgba(184,255,61,0.25)]"}`}>
        <div className="scan pointer-events-none absolute inset-0" />
        <div className="relative flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/50">
              {race.label ? `${race.label} · ` : ""}
              {originLabel}
            </div>
            <span ref={clockEl} className={`tnum block font-display leading-[0.9] text-chalk ${compact ? "text-6xl sm:text-7xl" : "text-[22vw] sm:text-[120px]"}`}>
              --:--.--
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 font-mono sm:gap-6 sm:text-right">
            <Stat label="runners" value={total} />
            <Stat label="bots" value={bots} accent="#b8ff3d" />
            <Stat label="humans" value={laneCounts.human} accent="#ffe14d" />
          </div>
        </div>

        <div className="relative px-1 pb-2 sm:px-3">
          <Track hits={sorted} origin={origin} clockRef={clockRef} mine={myHit?.t ?? null} compact={compact} appear={appear} />
        </div>

        <div className="relative min-h-[64px] border-t border-white/10 bg-black/40 px-4 py-3 sm:px-6">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-hype/80">race caller</div>
          {visibleCalls.length ? (
            <ul className="space-y-1">
              {visibleCalls.map((c, i) => (
                <li key={c.key} className={`ticker-in flex gap-3 text-[13px] leading-snug sm:text-sm ${i ? "text-white/45" : "text-chalk"}`}>
                  <span className="tnum shrink-0 font-mono text-[11px] leading-5" style={{ color: c.lane ? LANES[LANE_INDEX[c.lane]].color : "#f2f0e9" }}>
                    {fmtSecs(c.at)}
                  </span>
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-white/50">{loaded ? "Gates are loaded. Nobody has opened the link yet." : "Loading the track..."}</p>
          )}
        </div>
      </section>

      {compact ? null : (
        <>
          {myHit && (
            <div className="mt-4 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
              You crossed the line at <b className="tnum">{fmtSecs(myHit.t - origin)}</b>. {beatMe} bot{beatMe === 1 ? "" : "s"} got here before you did.
            </div>
          )}

          {key && <OwnerPanel race={race} k={key} raceUrl={raceUrl} onStarted={poll} />}

          <section className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {LANES.map((l) => {
              const lead = sorted.find((h) => h.l === l.id && h.t >= origin);
              return (
                <div key={l.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: l.color }}>
                    <span>{l.label}</span>
                  </div>
                  <div className="tnum mt-1 font-display text-4xl leading-none">{laneCounts[l.id]}</div>
                  <div className="mt-1 truncate font-mono text-[11px] text-white/50">{lead ? `${lead.n} · ${fmtSecs(lead.t - origin)}` : "no runner yet"}</div>
                </div>
              );
            })}
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_340px]">
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3">
                <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/70">Finish order</h2>
                <label className="flex items-center gap-2 font-mono text-[11px] text-white/50">
                  <input type="checkbox" checked={hideHumans} onChange={(e) => setHideHumans(e.target.checked)} className="accent-[#b8ff3d]" />
                  bots only
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left font-mono text-[12px]">
                  <thead className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                    <tr>
                      <th className="px-4 py-2">#</th>
                      <th className="px-2 py-2">time</th>
                      <th className="px-2 py-2">runner</th>
                      <th className="px-2 py-2">network</th>
                      <th className="px-4 py-2">check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.map((h, i) => {
                      const l = LANES[LANE_INDEX[h.l]];
                      return (
                        <tr key={h.s} className={`border-t border-white/5 ${myHit?.s === h.s ? "bg-gold/10" : ""}`} title={h.u || ""}>
                          <td className="tnum px-4 py-1.5 text-white/40">{i + 1}</td>
                          <td className={`tnum px-2 py-1.5 ${h.t < origin ? "text-flag" : "text-chalk"}`}>{fmtSecs(h.t - origin)}</td>
                          <td className="px-2 py-1.5">
                            <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: l.color }} />
                            {h.n}
                            {myHit?.s === h.s ? <b className="ml-2 text-gold">YOU</b> : null}
                          </td>
                          <td className="max-w-[220px] truncate px-2 py-1.5 text-white/55">{[h.o, h.h].filter(Boolean).join(" · ") || "unknown"}</td>
                          <td className="px-4 py-1.5">{h.l === "human" ? <span className="text-white/35">human</span> : h.v ? <span className="text-hype">network ok</span> : <span className="text-white/35">claims</span>}</td>
                        </tr>
                      );
                    })}
                    {!table.length && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-white/40">
                          Empty track. Post the link and watch this fill up.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {rows.length > 25 && (
                <button onClick={() => setShowAll((v) => !v)} className="w-full border-t border-white/10 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/55 hover:text-white">
                  {showAll ? "show fewer" : `show ${Math.min(300, rows.length)} of ${total}`}
                </button>
              )}
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-hype/30 bg-hype/[0.06] p-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-hype">AI lane</div>
                {laneCounts.ai ? (
                  <p className="mt-2 text-sm leading-relaxed text-white/80">
                    <b className="text-hype">{laneCounts.ai}</b> AI crawler{laneCounts.ai === 1 ? "" : "s"} showed up{firstAi ? `, first one ${fmtSecs(firstAi.t - origin)} after the gun` : ""}. Fast bots read your link. The question is whether AI answers ever cite your site.
                  </p>
                ) : (
                  <p className="mt-2 text-sm leading-relaxed text-white/80">No AI crawler has opened this link yet. If they skip your links, odds are ChatGPT and Perplexity don&apos;t know your site exists either.</p>
                )}
                <a href="https://outrank.so/?ref=bot-race" target="_blank" rel="noopener" className="mt-3 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-hype underline-offset-4 hover:underline">
                  Get cited by AI with Outrank &rarr;
                </a>
              </div>

              <div className="rounded-2xl border border-white/10 p-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">Share the photo finish</div>
                <a
                  href={`https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(photoUrl)}`}
                  target="_blank"
                  rel="noopener"
                  className="mt-3 block rounded-lg bg-chalk px-4 py-2.5 text-center text-sm font-semibold text-ink hover:bg-white"
                >
                  Post the result on X
                </a>
                {!key && (
                  <Link href="/#start" className="mt-2 block rounded-lg border border-white/20 px-4 py-2.5 text-center text-sm text-chalk hover:border-white/50">
                    Start your own race
                  </Link>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 p-4 text-[12px] leading-relaxed text-white/50">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">How we judge</div>
                Every request to the race link is a runner. The name comes from the user agent, which anyone can fake, so it says <i>claims</i> unless the network (reverse DNS or ASN owner) matches the company. A normal browser coming from a cloud server goes to the ghost lane. Scrapers that rent home internet connections still pass as humans, so the human lane is an upper bound. We never show IP addresses.
                {race.t0 ? <> Times use the tweet&apos;s own timestamp, read from its ID.</> : <> No tweet attached yet, so the clock starts at the first visit from X (or the first runner).</>}
              </div>
            </aside>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div>
      <div className="tnum font-display text-3xl leading-none sm:text-4xl" style={{ color: accent || "#f2f0e9" }}>
        {value.toLocaleString("en-US")}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/45">{label}</div>
    </div>
  );
}

function OwnerPanel({ race, k, raceUrl, onStarted }: { race: Race; k: string; raceUrl: string; onStarted: () => void }) {
  const [tweet, setTweet] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const fire = async () => {
    setBusy(true);
    setErr(null);
    const r = await fetch(`${BASE}/api/race/${race.id}/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: k, tweet }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(d.error || "Something broke.");
    setTweet("");
    onStarted();
  };
  return (
    <section className="mt-4 rounded-2xl border border-flag/40 bg-flag/[0.07] p-4 sm:p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-flag">your race · only you see this</div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <code className="flex-1 truncate rounded-lg border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-chalk">{raceUrl}</code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(raceUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-lg bg-chalk px-4 py-2.5 text-sm font-semibold text-ink"
        >
          {copied ? "Copied" : "Copy race link"}
        </button>
      </div>
      {race.t0 ? (
        <p className="mt-3 text-sm text-white/70">
          Gun fired at the tweet&apos;s timestamp.{" "}
          <a href={race.tweet || "#"} target="_blank" rel="noopener" className="text-chalk underline underline-offset-4">
            See the tweet
          </a>
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            1. Post the link on X (a main post is fastest, a reply hidden in a thread works too). 2. Paste the tweet URL here. We read the exact millisecond it went live from its ID and restart the clock from there. Anything that opened the link before that is a false start.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input value={tweet} onChange={(e) => setTweet(e.target.value)} placeholder="https://x.com/you/status/..." className="flex-1 rounded-lg border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-chalk placeholder:text-white/30 focus:border-flag focus:outline-none" />
            <button onClick={fire} disabled={busy || !tweet} className="rounded-lg bg-flag px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-40">
              {busy ? "Firing..." : "Fire the gun"}
            </button>
          </div>
          {err && <p className="mt-2 text-sm text-flag">{err}</p>}
        </>
      )}
    </section>
  );
}
