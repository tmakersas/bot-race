"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LANES, LANE_INDEX, type Board, type FeedItem } from "@/lib/lanes";
import { BASE } from "@/lib/site";
import { fmtSecs } from "@/lib/time";

type Global = { feed: FeedItem[]; today: { runners: number; bots: number; humans: number }; boards: Board; now: number };

function ago(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function useGlobal(initial: Global) {
  const [g, setG] = useState(initial);
  const [skew, setSkew] = useState(0);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = async () => {
      const r = await fetch(`${BASE}/api/global`, { cache: "no-store" }).catch(() => null);
      if (r?.ok) {
        const d = (await r.json()) as Global;
        setSkew(d.now - Date.now());
        setG(d);
      }
      t = setTimeout(loop, document.hidden ? 15000 : 3000);
    };
    t = setTimeout(loop, 3000);
    return () => clearTimeout(t);
  }, []);
  return { g, skew };
}

export function TodayCount({ initial }: { initial: Global }) {
  const { g } = useGlobal(initial);
  return (
    <span className="flex items-center gap-2">
      <span className="live-dot inline-block h-2 w-2 rounded-full bg-flag" />
      {g.today.runners.toLocaleString("en-US")} runners today · {g.today.humans.toLocaleString("en-US")} human{g.today.humans === 1 ? "" : "s"}
    </span>
  );
}

export default function LiveGlobal({ initial }: { initial: Global }) {
  const { g, skew } = useGlobal(initial);
  const [, tick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(i);
  }, []);
  const now = Date.now() + skew;
  const { humans, magnets, bots } = g.boards;

  return (
    <>
      <section className="pb-12">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">Every race, live</h2>
          <span className="font-mono text-[11px] text-white/40">
            today: {g.today.bots.toLocaleString("en-US")} bots, {g.today.humans.toLocaleString("en-US")} humans
          </span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
          {g.feed.length ? (
            <ul className="divide-y divide-white/5 font-mono text-[12px] sm:text-[13px]">
              {g.feed.slice(0, 12).map((f) => {
                const l = LANES[LANE_INDEX[f.l]];
                const where = f.house ? "this page" : f.who ? `@${f.who}'s link` : `race ${f.r}`;
                return (
                  <li key={`${f.r}-${f.t}-${f.n}`} className="ticker-in flex items-center gap-3 px-4 py-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: l.color, boxShadow: `0 0 10px ${l.color}` }} />
                    <span className="min-w-0 flex-1 truncate">
                      <span style={{ color: f.l === "human" ? "#ffe14d" : "#f2f0e9" }}>{f.n}</span>
                      <span className="text-white/35"> → </span>
                      {f.house ? (
                        <span className="text-white/60">{where}</span>
                      ) : (
                        <Link href={`/p/${f.r}`} className="text-white/60 hover:text-white">
                          {where}
                        </Link>
                      )}
                    </span>
                    <span className="tnum shrink-0 text-white/45" suppressHydrationWarning>{f.d !== null && f.d >= 0 ? `${fmtSecs(f.d)} after the tweet` : ago(now - f.t)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-6 text-sm text-white/50">Quiet track. You&apos;re about to show up here.</p>
          )}
        </div>
      </section>

      <section className="grid gap-4 pb-12 lg:grid-cols-3">
        <div className="rounded-2xl border border-gold/30 bg-gold/[0.05] p-5">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">Fastest humans ever</h2>
          <p className="mt-1 text-xs text-white/45">Seconds from the tweet to their click. Beat one and they drop off.</p>
          <ol className="mt-4 space-y-1.5 font-mono text-[13px]">
            {humans.length ? (
              humans.map((h, i) => (
                <li key={h.handle + h.race} className="flex items-center gap-3">
                  <span className={`w-5 ${i === 0 ? "text-gold" : "text-white/35"}`}>{i + 1}</span>
                  <a href={`https://x.com/${h.handle}`} target="_blank" rel="noopener" className={`min-w-0 flex-1 truncate hover:underline ${i === 0 ? "text-gold" : ""}`}>
                    @{h.handle}
                    {h.owner ? <span className="text-white/35"> on @{h.owner}</span> : null}
                  </a>
                  <span className="tnum text-chalk">{fmtSecs(h.ms)}</span>
                </li>
              ))
            ) : (
              <li className="text-white/50">Empty. The first human to click a race link and claim it takes #1.</li>
            )}
          </ol>
        </div>
        <div className="rounded-2xl border border-hype/30 bg-hype/[0.05] p-5">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-hype">Bot magnets</h2>
          <p className="mt-1 text-xs text-white/45">Tweets that pulled the most bots in their first 10 minutes. Bots go where the reach is.</p>
          <ol className="mt-4 space-y-1.5 font-mono text-[13px]">
            {magnets.length ? (
              magnets.map((m, i) => (
                <li key={m.race} className="flex items-center gap-3">
                  <span className={`w-5 ${i === 0 ? "text-hype" : "text-white/35"}`}>{i + 1}</span>
                  <Link href={`/p/${m.race}`} className="min-w-0 flex-1 truncate hover:underline">
                    @{m.owner}
                  </Link>
                  <span className="tnum text-chalk">{m.bots.toLocaleString("en-US")} bots</span>
                </li>
              ))
            ) : (
              <li className="text-white/50">Empty. Post a race link, paste the tweet, take #1.</li>
            )}
          </ol>
        </div>
        <div className="rounded-2xl border border-white/10 p-5">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">Fastest bots ever</h2>
          <p className="mt-1 text-xs text-white/45">Tweet to first request, per bot, across every timed race.</p>
          <ol className="mt-4 space-y-1.5 font-mono text-[13px]">
            {bots.length ? (
              bots.slice(0, 10).map((f, i) => (
                <li key={f.lane + f.name} className="flex items-center gap-3">
                  <span className="w-5 text-white/35">{i + 1}</span>
                  <span className="h-2 w-2 rounded-full" style={{ background: LANES[LANE_INDEX[f.lane]]?.color }} />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="tnum text-hype">{fmtSecs(f.ms)}</span>
                </li>
              ))
            ) : (
              <li className="text-white/50">No timed race yet.</li>
            )}
          </ol>
        </div>
      </section>
    </>
  );
}
