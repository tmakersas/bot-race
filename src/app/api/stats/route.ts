import { countRaces, getBoards } from "@/lib/store";

export async function GET() {
  const [boards, races] = await Promise.all([getBoards(15), countRaces()]);
  return Response.json({ ...boards, races }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=30" } });
}
