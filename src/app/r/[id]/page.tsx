import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RaceView from "@/components/RaceView";
import Footer from "@/components/Footer";
import { getRace } from "@/lib/store";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/r/[id]">): Promise<Metadata> {
  const { id } = await params;
  const title = "This link is a race. The bots are winning.";
  const description = "Every bot that opens this link is being timed, live. The first human to click gets their name on the board. Click to see how many bots beat you.";
  const url = `${SITE}/r/${id}`;
  // A fixed card: X caches the first card it sees, and the race is empty at that moment.
  const image = `${SITE}/api/og?gate=${id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: false },
    openGraph: { title, description, url, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image], creator: "@tibo_maker" },
  };
}

export default async function RacePage({ params }: PageProps<"/r/[id]">) {
  const { id } = await params;
  const race = await getRace(id);
  if (!race) notFound();
  return (
    <main>
      <RaceView initial={race} />
      <Footer />
    </main>
  );
}
