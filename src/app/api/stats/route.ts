import { countRaces, getFastest } from "@/lib/store";

export async function GET() {
  const [fastest, races] = await Promise.all([getFastest(15), countRaces()]);
  return Response.json({ fastest, races }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=30" } });
}
