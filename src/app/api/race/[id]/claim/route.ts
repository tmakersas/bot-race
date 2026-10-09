import { cookies } from "next/headers";
import { clientIp } from "@/lib/classify";
import { readRunner } from "@/lib/sign";
import { claimRunner, rateLimit } from "@/lib/store";

export async function POST(req: Request, ctx: RouteContext<"/api/race/[id]/claim">) {
  const { id } = await ctx.params;
  const ip = clientIp(req.headers) || "unknown";
  if (!(await rateLimit(`claim:${ip}`, 8, 600))) return Response.json({ error: "Easy, champ. Try again in a few minutes." }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const handle = String(body?.handle || "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "")
    .split(/[/?#]/)[0];
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return Response.json({ error: "That is not an X handle. Letters, numbers and _ only." }, { status: 400 });
  const jar = await cookies();
  const t = readRunner(id, jar.get(`br_me_${id}`)?.value);
  if (t === null) return Response.json({ error: "Only the runner who crossed the line from this browser can claim the spot." }, { status: 403 });
  const r = await claimRunner(id, t, handle);
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json(r);
}
