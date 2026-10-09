import { getBoards, getDay, getFeed, houseId } from "@/lib/store";

// Everything happening across every race, for the homepage. CDN cached for 2s,
// so a crowd watching the homepage costs one set of Redis reads every 2 seconds.
export async function GET() {
  const [feed, today, boards] = await Promise.all([getFeed(40), getDay(), getBoards(10)]);
  return Response.json(
    { feed, today, boards, house: houseId(), now: Date.now() },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=2, stale-while-revalidate=4" } },
  );
}
