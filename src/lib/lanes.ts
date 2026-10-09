// Lanes and colors, shared by the server classifier and the client race view.
export type LaneId = "x" | "ai" | "search" | "seo" | "social" | "script" | "ghost" | "human";

export const LANES: { id: LaneId; label: string; short: string; color: string; blurb: string }[] = [
  { id: "x", label: "X itself", short: "X", color: "#f2f0e9", blurb: "Twitterbot and anything else coming from X's own network." },
  { id: "ai", label: "AI crawlers", short: "AI", color: "#b8ff3d", blurb: "GPTBot, ClaudeBot, PerplexityBot, Bytespider, Meta and friends." },
  { id: "search", label: "Search engines", short: "SEARCH", color: "#5ec8ff", blurb: "Googlebot, Bingbot, Applebot, Yandex, DuckDuckGo." },
  { id: "seo", label: "SEO & data tools", short: "SEO", color: "#ffb13d", blurb: "Ahrefs, Semrush, Majestic, DataForSEO and other index builders." },
  { id: "social", label: "Link previews", short: "PREVIEW", color: "#c58bff", blurb: "Other apps building a card: Facebook, Slack, Discord, Telegram, LinkedIn." },
  { id: "script", label: "Scripts & monitors", short: "SCRIPT", color: "#ff6b9a", blurb: "curl, python, Go, Java, headless clients and anything that says bot without a name." },
  { id: "ghost", label: "Browsers in data centers", short: "GHOST", color: "#ff5a36", blurb: "A normal Chrome or Safari user agent, but coming from a cloud server. Nobody browses X from AWS." },
  { id: "human", label: "Humans", short: "HUMAN", color: "#ffe14d", blurb: "A browser on a home, office or mobile network. Probably a person. Probably." },
];

export const LANE_INDEX: Record<LaneId, number> = Object.fromEntries(LANES.map((l, i) => [l.id, i])) as Record<LaneId, number>;

/** Compact hit as stored and sent to the client. */
export type Hit = {
  s: number; // arrival order in this race, 1-based
  t: number; // server time in ms (epoch)
  l: LaneId;
  n: string; // display name: "Twitterbot", "Chrome on AWS", "Human"
  v: 0 | 1; // 1 = network matches the claimed owner (reverse DNS or ASN), 0 = just claims it
  o?: string; // network owner from ASN, short ("Amazon", "X Corp")
  h?: string; // reverse DNS host, only for non-humans
  m?: string; // HTTP method when not GET
  u?: string; // short user agent, only for non-humans
  c?: string; // country code, humans only
};

export type Race = {
  id: string;
  created: number;
  t0: number | null; // tweet time in ms (from the snowflake), null until set
  tweet: string | null;
  label: string | null;
  count: number;
  lanes: Partial<Record<LaneId, number>>;
  house?: boolean; // today's race on the homepage: every visitor of tmaker.io/bot-race
  owner?: string | null; // X handle read from the tweet URL, once pasted
  claims?: Record<string, string>; // arrival number -> X handle, humans who put their name on it
};

/** One line in the live feed of every race. */
export type FeedItem = { r: string; who: string; house: 0 | 1; l: LaneId; n: string; o?: string; d: number | null; t: number };

export type Board = {
  humans: { handle: string; race: string; ms: number; owner?: string | null }[];
  magnets: { race: string; owner: string; bots: number }[];
  bots: { lane: LaneId; name: string; ms: number; race?: string }[];
};

/** What a visitor sees about themselves, computed when they arrive (place 0 = not a human). */
export type Me = { s: number; t: number; l: LaneId; n: string; beat: number; place: number };
