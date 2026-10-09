import { LANES, LANE_INDEX, type Hit, type Race } from "@/lib/lanes";
import { fmtSecs } from "@/lib/time";
import { watchers } from "@/lib/watchers";

// Paranoia, served straight: the companies that read the link before a person did.
export default function Watchers({ race, sorted, origin, myHit }: { race: Race; sorted: Hit[]; origin: number; myHit: Hit | null }) {
  const firstHuman = sorted.find((h) => h.l === "human" && (race.house || h.t >= origin));
  const cut = myHit && myHit.l === "human" ? myHit : firstHuman;
  const pool = cut ? sorted.filter((h) => h.t < cut.t) : sorted;
  const list = watchers(pool);
  if (!list.length) return null;
  const who = myHit && myHit.l === "human" ? "you did" : "the first human did";
  const head = cut
    ? `${list.length} ${list.length === 1 ? "company" : "companies"} read ${race.house ? "this page" : "this link"} before ${who}.`
    : `${list.length} ${list.length === 1 ? "company has" : "companies have"} read this link. Not one human yet.`;
  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/50">who&apos;s watching</div>
      <h2 className="mt-1 font-display text-3xl uppercase leading-none sm:text-4xl">{head}</h2>
      <ul className="mt-4 flex flex-wrap gap-2">
        {list.slice(0, 24).map((w) => {
          const l = LANES[LANE_INDEX[w.first.l]];
          return (
            <li key={w.name} className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-[12px]" title={w.first.n}>
              <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
              <span className="text-chalk">{w.name}</span>
              <span className="tnum text-white/45">{race.house ? new Date(w.first.t).toISOString().slice(11, 16) : fmtSecs(w.first.t - origin)}</span>
              {w.count > 1 && <span className="text-white/35">x{w.count}</span>}
            </li>
          );
        })}
        {list.length > 24 && <li className="px-2 py-1.5 font-mono text-[12px] text-white/40">+{list.length - 24} more</li>}
      </ul>
    </section>
  );
}
