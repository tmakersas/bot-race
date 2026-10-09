import { getRaceRaw, setStart } from "@/lib/store";
import { tweetTime } from "@/lib/time";

export async function POST(req: Request, ctx: RouteContext<"/api/race/[id]/start">) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const key = String(body?.key || "");
  const tw = tweetTime(String(body?.tweet || ""));
  if (!tw) return Response.json({ error: "That does not look like a tweet link. Paste the x.com/.../status/... URL." }, { status: 400 });
  const raw = await getRaceRaw(id);
  if (!raw) return Response.json({ error: "No such race" }, { status: 404 });
  const created = Number(raw.created);
  if (tw.t < created - 60_000) return Response.json({ error: "That tweet is older than this race. Post the race link in a new tweet, then paste that one." }, { status: 400 });
  if (tw.t > Date.now() + 60_000) return Response.json({ error: "That tweet is from the future. Impressive, but no." }, { status: 400 });
  const handle = String(body?.tweet || "").match(/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status/)?.[1];
  const tweet = handle ? `https://x.com/${handle}/status/${tw.id}` : `https://x.com/i/status/${tw.id}`;
  const r = await setStart(id, key, tw.t, tweet);
  if (r === "nokey") return Response.json({ error: "Only the person who started this race can fire the gun." }, { status: 403 });
  if (r === "missing") return Response.json({ error: "No such race" }, { status: 404 });
  return Response.json({ ok: true, t0: tw.t, tweet });
}
