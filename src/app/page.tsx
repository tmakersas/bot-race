import Link from "next/link";
import Footer from "@/components/Footer";
import RaceView from "@/components/RaceView";
import StartRace from "@/components/StartRace";
import { LANES, LANE_INDEX } from "@/lib/lanes";
import { countRaces, getFastest, getFeatured, getRace } from "@/lib/store";
import { fmtSecs } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function Home() {
  const featuredId = await getFeatured().catch(() => null);
  const [featured, fastest, races] = await Promise.all([
    featuredId ? getRace(featuredId).catch(() => null) : null,
    getFastest(12).catch(() => []),
    countRaces().catch(() => 0),
  ]);

  return (
    <main>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(184,255,61,0.14),transparent)]" />
      <div className="relative mx-auto max-w-6xl px-4 pt-5 sm:px-6">
        <header className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-white/55">
          <span className="font-display text-lg tracking-wider text-chalk">BOT RACE</span>
          <span>{races ? `${races.toLocaleString("en-US")} race${races === 1 ? "" : "s"} run` : "gates open"}</span>
        </header>

        <section className="pb-10 pt-12 sm:pt-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-hype">who opens your link first?</p>
          <h1 className="mt-4 font-display text-[17vw] uppercase leading-[0.86] tracking-tight sm:text-[128px]">
            This link is
            <br />a racetrack<span className="text-hype">.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70 sm:text-xl">
            Post a link on X and thousands of bots open it within seconds. So we gave them lanes. Every request gets timed from the millisecond your tweet goes live: X, AI crawlers, SEO tools, monitoring firms, ghosts in data centers. Humans come last.
          </p>
          <div className="mt-8">
            <StartRace big />
          </div>
        </section>

        {featured && (
          <section className="pb-12">
            <div className="mb-3 flex items-end justify-between">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">Featured race{featured.label ? `: ${featured.label}` : ""}</h2>
              <Link href={`/p/${featured.id}`} className="font-mono text-[11px] uppercase tracking-[0.16em] text-hype hover:underline">
                full race &rarr;
              </Link>
            </div>
            <RaceView initial={featured} compact />
          </section>
        )}

        <section className="grid gap-4 pb-12 sm:grid-cols-3">
          {[
            ["01", "Start a race", "You get a fresh link nobody has ever seen. No account."],
            ["02", "Post it on X", "Then paste the tweet URL. Its ID holds the exact millisecond it went live, so the clock starts there."],
            ["03", "Watch the stampede", "Every bot gets a lane and a split time. The race caller calls it. Share the photo finish."],
          ].map(([n, t, d]) => (
            <div key={n} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="font-mono text-[11px] text-hype">{n}</div>
              <div className="mt-2 font-display text-2xl uppercase tracking-wide">{t}</div>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{d}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 pb-14 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 p-5">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">Fastest reactions ever recorded</h2>
            <p className="mt-1 text-xs text-white/40">Time from tweet to first request, per bot, across every race with a tweet attached.</p>
            <ol className="mt-4 space-y-1.5 font-mono text-[13px]">
              {fastest.length ? (
                fastest.map((f, i) => (
                  <li key={f.lane + f.name} className="flex items-center gap-3">
                    <span className="w-5 text-white/35">{i + 1}</span>
                    <span className="h-2 w-2 rounded-full" style={{ background: LANES[LANE_INDEX[f.lane]]?.color }} />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="tnum text-hype">{fmtSecs(f.ms)}</span>
                  </li>
                ))
              ) : (
                <li className="text-white/40">No timed race yet. Yours could set the first record.</li>
              )}
            </ol>
          </div>
          <div className="rounded-2xl border border-white/10 p-5">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">The eight lanes</h2>
            <ul className="mt-4 space-y-2.5">
              {LANES.map((l, i) => (
                <li key={l.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: l.color }} />
                  <span>
                    <b className="font-mono text-[12px] uppercase tracking-wide" style={{ color: l.color }}>
                      {i + 1} {l.label}
                    </b>
                    <span className="block text-white/55">{l.blurb}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
}
