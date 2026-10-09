import type { NextConfig } from "next";

// The app lives at https://www.tmaker.io/bot-race (rewrite in tmaker-portfolio),
// so every route and asset is served under this base path.
const BASE = "/bot-race";

const nextConfig: NextConfig = {
  basePath: BASE,
  outputFileTracingIncludes: {
    "/api/og": ["./assets/**/*"],
  },
  images: { unoptimized: true },
  redirects: async () => [
    // Links on the bare vercel.app domain go to the tmaker.io home of the app.
    {
      source: "/:path((?!bot-race(?:/|$)).*)",
      destination: "https://www.tmaker.io/bot-race/:path",
      permanent: false,
      basePath: false,
    },
  ],
};

export default nextConfig;
