import { clientIp } from "@/lib/classify";
import { createRace, rateLimit } from "@/lib/store";

export async function POST(req: Request) {
  const ip = clientIp(req.headers) || "unknown";
  if (!(await rateLimit(`create:${ip}`, 6, 600))) {
    return Response.json({ error: "Slow down, jockey. Six races per 10 minutes." }, { status: 429 });
  }
  let label: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.label === "string") label = body.label.replace(/[<>]/g, "").trim().slice(0, 40) || null;
  } catch {}
  const r = await createRace(label);
  return Response.json(r);
}
