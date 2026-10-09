"use client";

import { useState } from "react";
import { LANES, LANE_INDEX, type Hit, type Race } from "@/lib/lanes";
import type { Me } from "@/lib/lanes";
import { BASE, SITE } from "@/lib/site";
import { fmtSecs } from "@/lib/time";

type Props = { race: Race; sorted: Hit[]; origin: number; myHit: Me; onClaimed: () => void };

// The first thing a visitor feels: where they finished, who beat them, and a
// spot on the board they can take before someone else does.
export default function YouBanner({ race, sorted, origin, myHit, onClaimed }: Props) {
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const claims = race.claims || {};
  const myClaim = claims[String(myHit.s)];
  const { beat, place } = myHit;
  const first = place > 1 ? sorted.find((h) => h.l === "human" && h.t < myHit.t && (race.house || h.t >= origin)) : undefined;
  const firstName = first ? claims[String(first.s)] : null;
  const where = race.house ? "this page today" : race.owner ? `@${race.owner}'s link` : "this link";

  if (myHit.l !== "human") {
    const lane = LANES[LANE_INDEX[myHit.l]];
    return (
      <div className="rounded-2xl border border-flag/50 bg-flag/10 p-5">
        <div className="font-display text-4xl uppercase leading-none text-flag sm:text-5xl">Our judges think you&apos;re a bot.</div>
        <p className="mt-2 text-sm text-white/70">
          You came in as <b className="text-chalk">{myHit.n}</b> in the {lane.label.toLowerCase()} lane. VPN or office proxy? Bots can&apos;t claim a spot on the board. That&apos;s the rule.
        </p>
      </div>
    );
  }

  const claim = async () => {
    setBusy(true);
    setErr(null);
    const r = await fetch(`${BASE}/api/race/${race.id}/claim`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ handle }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(d.error || "Could not claim it. Try again.");
    onClaimed();
  };

  const shareUrl = race.house ? SITE : `${SITE}/p/${race.id}`;
  const shareText = race.house
    ? place === 1
      ? `I was the first human on Bot Race today 🏆\nstill, ${beat} bots got there before me`
      : `I lost to ${beat} bots on Bot Race today 😅\nhuman #${place}. how fast are you?`
    : place === 1
      ? `first human on ${race.owner ? `@${race.owner}'s` : "this"} link 🏆\n${beat} bots still beat me`
      : `I lost to ${beat} bots on ${race.owner ? `@${race.owner}'s` : "this"} link 😅\nhuman #${place}`;

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 sm:p-6 ${place === 1 ? "border-gold/60 bg-gold/[0.09]" : "border-flag/40 bg-flag/[0.07]"}`}>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
        your result · you crossed the line {race.house ? `at ${new Date(myHit.t).toISOString().slice(11, 19)} UTC` : `at ${fmtSecs(myHit.t - origin)}`}
      </div>
      {place === 1 ? (
        <>
          <div className="mt-2 font-display text-5xl uppercase leading-[0.9] text-gold sm:text-7xl">
            You&apos;re the first human{race.house ? " today" : ""}.
          </div>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/75">
            {beat ? (
              <>
                Still, <b className="text-chalk">{beat.toLocaleString("en-US")} bot{beat === 1 ? "" : "s"}</b> got to {where} before you.{" "}
              </>
            ) : null}
            {myClaim ? "Your name is on it." : "The spot is yours, but it has no name on it yet. Put yours before somebody fakes it."}
          </p>
        </>
      ) : (
        <>
          <div className="mt-2 font-display text-5xl uppercase leading-[0.9] text-chalk sm:text-7xl">
            You lost to <span className="text-flag">{beat.toLocaleString("en-US")}</span> bot{beat === 1 ? "" : "s"}.
          </div>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/75">
            And to {place - 1} human{place - 1 === 1 ? "" : "s"}. You&apos;re human <b className="text-chalk">#{place}</b> on {where}.{" "}
            {first ? (
              <>
                {firstName ? (
                  <a href={`https://x.com/${firstName}`} target="_blank" rel="noopener" className="font-semibold text-gold underline-offset-4 hover:underline">
                    @{firstName}
                  </a>
                ) : (
                  "The first human"
                )}{" "}
                beat you by <b className="tnum text-chalk">{fmtSecs(myHit.t - first.t)}</b>.
              </>
            ) : null}
          </p>
        </>
      )}

      {myClaim ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="font-mono text-sm text-gold">@{myClaim} is on the board · human #{place}</span>
          <a
            href={`https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
            target="_blank"
            rel="noopener"
            className="rounded-lg bg-chalk px-4 py-2 text-center text-sm font-semibold text-ink hover:bg-white sm:ml-auto"
          >
            Brag about it on X
          </a>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-1 items-center rounded-lg border border-white/20 bg-black/50 px-3 focus-within:border-gold">
            <span className="font-mono text-white/40">@</span>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              maxLength={40}
              placeholder="your X handle"
              className="w-full bg-transparent px-1 py-2.5 text-sm text-chalk placeholder:text-white/30 focus:outline-none"
            />
          </div>
          <button onClick={claim} disabled={busy || !handle.trim()} className={`rounded-lg px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-40 ${place === 1 ? "bg-gold" : "bg-chalk"}`}>
            {busy ? "Signing..." : place === 1 ? "Claim first place" : `Claim human #${place}`}
          </button>
        </div>
      )}
      {err && <p className="mt-2 text-sm text-flag">{err}</p>}
      {!myClaim && <p className="mt-2 font-mono text-[11px] text-white/40">Only this browser can claim this spot. Claims close 30 minutes after you cross the line.</p>}
    </div>
  );
}
