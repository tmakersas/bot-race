import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RaceView from "@/components/RaceView";
import Footer from "@/components/Footer";
import { getRace } from "@/lib/store";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

// The photo finish: same race, but opening it does not add a runner,
// and the share card shows the result.
export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const { id } = await params;
  const race = await getRace(id);
  const n = race?.count ?? 0;
  const bots = n - (race?.lanes.human ?? 0);
  const title = race ? `Photo finish: ${bots} bots opened one link` : "Bot Race photo finish";
  const description = "Who opens your link first after you post it on X? The full race, replayed: lanes, split times, the race caller.";
  const url = `${SITE}/p/${id}`;
  const image = `${SITE}/api/og?r=${id}&n=${n}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image], creator: "@tibo_maker" },
  };
}

export default async function PhotoPage({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const race = await getRace(id);
  if (!race) notFound();
  return (
    <main>
      <RaceView initial={race} photo />
      <Footer />
    </main>
  );
}
