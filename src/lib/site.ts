// Served at https://www.tmaker.io/bot-race through a rewrite in tmaker-portfolio.
export const BASE = "/bot-race";
export const SITE = process.env.NEXT_PUBLIC_SITE_URL || `https://www.tmaker.io${BASE}`;

export const TITLE = "Bot Race: who opens your link first?";
export const DESC =
  "Post a race link on X. Every bot that opens it gets timed from the second your tweet goes live: X, AI crawlers, SEO tools, monitoring firms, then the humans. Live lanes, split times, photo finish.";
