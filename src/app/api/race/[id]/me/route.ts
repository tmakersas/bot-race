import { cookies } from "next/headers";
import { readRunner } from "@/lib/sign";
import { getMe } from "@/lib/store";

// The visitor's own result, from their signed runner cookie. Never cached.
export async function GET(_req: Request, ctx: RouteContext<"/api/race/[id]/me">) {
  const { id } = await ctx.params;
  const jar = await cookies();
  const t = readRunner(id, jar.get(`br_me_${id}`)?.value);
  if (t === null) return Response.json({ me: null }, { headers: { "Cache-Control": "private, no-store" } });
  const me = await getMe(id, t);
  return Response.json({ me, t }, { headers: { "Cache-Control": "private, no-store" } });
}
