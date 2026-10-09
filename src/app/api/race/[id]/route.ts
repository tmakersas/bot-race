import { getHits, getRace, MAX_STORED } from "@/lib/store";

const CHUNK = 500;

export async function GET(req: Request, ctx: RouteContext<"/api/race/[id]">) {
  const { id } = await ctx.params;
  const race = await getRace(id);
  if (!race) return Response.json({ error: "No such race" }, { status: 404 });
  const chunk = Math.max(0, Math.min(Math.floor(MAX_STORED / CHUNK), Number(new URL(req.url).searchParams.get("chunk") || 0) | 0));
  const hits = await getHits(id, chunk * CHUNK, chunk * CHUNK + CHUNK - 1);
  return Response.json(
    { race, chunk, size: CHUNK, hits, now: Date.now() },
    // Shared 1s cache: a thousand people watching cost one Redis read per second.
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=1, stale-while-revalidate=2" } },
  );
}
