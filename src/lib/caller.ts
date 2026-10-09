import { LANES, type Hit, type LaneId } from "./lanes";
import { fmtSecs } from "./time";

// The race caller. Pure function of the hits, so the replay and the live view
// say exactly the same things at the same race time.
export type Call = { at: number; text: string; lane?: LaneId; key: string };

const laneLabel = (l: LaneId) => LANES.find((x) => x.id === l)!.label;
const who = (h: Hit) => (h.o && h.l !== "human" && !h.n.includes(h.o) ? `${h.n} (${h.o})` : h.n);

export function buildCalls(hits: Hit[], origin: number, hasTweet: boolean): Call[] {
  const calls: Call[] = [];
  if (!hits.length) return calls;
  const sorted = [...hits].sort((a, b) => a.t - b.t || a.s - b.s);
  const rel = (h: Hit) => h.t - origin;

  const early = sorted.filter((h) => rel(h) < 0);
  if (hasTweet && early.length) {
    const f = early[0];
    calls.push({
      at: rel(f),
      key: "false-start",
      lane: f.l,
      text:
        f.l === "x"
          ? `False start! ${f.n} peeked at the link ${fmtSecs(-rel(f))} before the tweet even existed. That's X building the card while you were typing.`
          : `False start! ${who(f)} opened the link ${fmtSecs(-rel(f))} before the tweet went live.`,
    });
  }

  const after = sorted.filter((h) => rel(h) >= 0);
  if (after.length) {
    const f = after[0];
    calls.push({ at: rel(f), key: "off", lane: f.l, text: hasTweet ? `And they're off! ${who(f)} is first out of the gate at ${fmtSecs(rel(f))}.` : `And they're off! ${who(f)} breaks first.` });
  }

  const outsider = after.find((h) => h.l !== "x" && h.l !== "human");
  if (outsider) {
    calls.push({
      at: rel(outsider),
      key: "outsider",
      lane: outsider.l,
      text: `Here comes the first outsider! ${who(outsider)} at ${fmtSecs(rel(outsider))}. Not X, not a human. Somebody is watching.`,
    });
  }

  const seen = new Set<LaneId>();
  for (const h of after) {
    if (seen.has(h.l)) continue;
    seen.add(h.l);
    if (h === after[0] || h === outsider) continue;
    const t = fmtSecs(rel(h));
    let text = `New lane opens, ${laneLabel(h.l)}: ${who(h)} at ${t}.`;
    if (h.l === "ai") text = `The AI crawlers have arrived. ${who(h)} at ${t}. This page is now someone's training data.`;
    if (h.l === "ghost") text = `Suspicious runner! ${h.n} at ${t}. Says it's a browser, lives in a data center. Nobody scrolls X from a server rack.`;
    if (h.l === "human") {
      const bots = after.filter((x) => x.t < h.t && x.l !== "human").length;
      text = `Finally, a human! ${t} in, and ${bots} bot${bots === 1 ? "" : "s"} already got here first.`;
    }
    if (h.l === "seo") text = `SEO tools on the rail: ${who(h)} at ${t}. Your link is already in somebody's backlink index.`;
    if (h.l === "search") text = `Search engines join: ${who(h)} at ${t}.`;
    if (h.l === "social") text = `Another app wants a preview: ${who(h)} at ${t}.`;
    if (h.l === "script") text = `A script with no manners: ${who(h)} at ${t}.`;
    calls.push({ at: rel(h), key: `lane-${h.l}`, lane: h.l, text });
  }

  // Photo finishes between two different non-human runners.
  let photos = 0;
  for (let i = 1; i < after.length && photos < 3; i++) {
    const a = after[i - 1];
    const b = after[i];
    if (a.l === "human" || b.l === "human" || a.n === b.n) continue;
    const d = b.t - a.t;
    if (d <= 25 && rel(b) > 0) {
      calls.push({ at: rel(b), key: `photo-${b.s}`, lane: b.l, text: `Photo finish! ${a.n} and ${b.n}, ${d}ms apart at ${fmtSecs(rel(b))}.` });
      photos++;
      i += 5;
    }
  }

  // Impostors: famous name on the jersey, wrong network underneath.
  const impostor = after.find((h) => h.v === 0 && /Googlebot|Bingbot|GPTBot|ClaudeBot|Twitterbot|facebookexternalhit|Applebot/.test(h.n) && h.o);
  if (impostor) {
    calls.push({ at: rel(impostor), key: "impostor", lane: impostor.l, text: `Stewards' inquiry: "${impostor.n}" says so on the jersey, but it's running out of ${impostor.o}. Not where the real one lives.` });
  }

  for (const n of [10, 50, 100, 250, 500, 1000, 2500]) {
    const h = sorted[n - 1];
    if (!h || rel(h) < 0) continue;
    const bots = sorted.slice(0, n).filter((x) => x.l !== "human").length;
    calls.push({ at: rel(h), key: `m-${n}`, text: `${n} runners on the track ${fmtSecs(rel(h))} after the gun. ${bots} of them are bots.` });
  }

  return calls.sort((a, b) => a.at - b.at);
}
