import type { Metadata, Viewport } from "next";
import { Anton, Instrument_Serif, JetBrains_Mono, Geist } from "next/font/google";
import "./globals.css";
import { DESC, SITE, TITLE } from "@/lib/site";

const anton = Anton({ variable: "--font-anton", subsets: ["latin"], weight: "400" });
const mono = JetBrains_Mono({ variable: "--font-jb", subsets: ["latin"], weight: ["400", "500", "700"] });
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESC,
  alternates: { canonical: SITE },
  openGraph: { title: TITLE, description: DESC, url: SITE, images: [{ url: `${SITE}/api/og`, width: 1200, height: 630 }], type: "website" },
  twitter: { card: "summary_large_image", creator: "@tibo_maker", title: TITLE, description: DESC, images: [`${SITE}/api/og`] },
};

export const viewport: Viewport = { themeColor: "#07080a", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${anton.variable} ${mono.variable} ${geist.variable} ${serif.variable}`}>
      <body className="grain min-h-dvh">{children}</body>
    </html>
  );
}
