import Footer from "@/components/Footer";
import LiveGlobal, { TodayCount } from "@/components/LiveGlobal";
import RaceView from "@/components/RaceView";
import StartRace from "@/components/StartRace";
import { LANES } from "@/lib/lanes";
import { ensureHouse, getBoards, getDay, getFeed, getRace, houseId } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const hid = houseId();
  await ensureHouse(hid).catch(() => null);
  const [house, feed, today, boards] = await Promise.all([
    getRace(hid).catch(() => null),
    getFeed(40).catch(() => []),
    getDay().catch(() => ({ runners: 0, bots: 0, humans: 0 })),
    getBoards(10).catch(() => ({ humans: [], magnets: [], bots: [] })),
  ]);
  const global = { feed, today, boards, now: Date.now() };
  const botsHere = house ? house.count - (house.lanes.human || 0) : 0;

  return (
    <main>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(255,90,54,0.14),transparent)]" />
      <div className="relative mx-auto max-w-6xl px-4 pt-5 sm:px-6">
        <header className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-white/55">
          <span className="font-display text-lg tracking-wider text-chalk">BOT RACE</span>
          <TodayCount initial={global} />
        </header>

        <section className="pb-6 pt-10 sm:pt-14">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-flag">
            this page is a race · {botsHere ? `${botsHere.toLocaleString("en-US")} bot${botsHere === 1 ? " is" : "s are"} ahead of you` : "no bot here yet today"}
          </p>
          <h1 className="mt-3 font-display text-[15vw] uppercase leading-[0.86] tracking-tight sm:text-[112px]">
            {botsHere ? (
              <>
                Bots got here
                <br />
                before you<span className="text-flag">.</span>
              </>
            ) : (
              <>
                You beat the bots
                <br />
                today. For now<span className="text-flag">.</span>
              </>
            )}
          </h1>
          <p className="mt-5 hidden max-w-2xl text-lg leading-relaxed text-white/70 sm:block">
            Every visit to this page is a runner, timed since midnight UTC: Google, OpenAI, SEO tools, scripts, browsers hiding in data centers. Then you. The first human of the day gets their name on the board.
          </p>
        </section>

        {house && (
          <section className="pb-12">
            <RaceView initial={house} compact showYou />
          </section>
        )}

        <section id="start" className="mb-12 scroll-mt-6 rounded-3xl border border-hype/30 bg-[radial-gradient(80%_120%_at_0%_0%,rgba(184,255,61,0.12),transparent)] p-6 sm:p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-hype">now do it to your tweets</p>
          <h2 className="mt-3 font-display text-5xl uppercase leading-[0.9] sm:text-7xl">Who reads your tweets before your followers do?</h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/70">
            Get a race link and post it on X. Within seconds, X, AI labs, search engines and SEO tools open it, each one timed and named. Your followers race them, and each other, to be the first human.
          </p>
          <div className="mt-6">
            <StartRace big />
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["01", "Start a race", "A fresh link nobody has ever seen. No account."],
              ["02", "Post it on X", "That's all. The clock starts the moment X opens your link."],
              ["03", "Watch who shows up", "Every company reading your tweet, in order. Then the humans fight for first place."],
            ].map(([n, t, d]) => (
              <div key={n} className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <div className="font-mono text-[11px] text-hype">{n}</div>
                <div className="mt-2 font-display text-2xl uppercase tracking-wide">{t}</div>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <LiveGlobal initial={global} />

        <section className="pb-14">
          <div className="rounded-2xl border border-white/10 p-5">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">The eight lanes</h2>
            <ul className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
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
            <p className="mt-4 text-[12px] leading-relaxed text-white/45">
              Names come from user agents, which anyone can fake, so a bot only gets &quot;network ok&quot; when its network matches the company. Scrapers that rent home connections still pass as humans. We never show IP addresses. Claims are honor-system X handles, not verified accounts.
            </p>
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
}
