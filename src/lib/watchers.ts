import type { Hit } from "./lanes";

// "Who is watching you": collapse runners into the companies behind them.
const BY_NAME: [RegExp, string][] = [
  [/^Twitterbot|^X /, "X"],
  [/^Googlebot|^Google /, "Google"],
  [/^Bingbot/, "Microsoft"],
  [/^Applebot/, "Apple"],
  [/^AhrefsBot/, "Ahrefs"],
  [/^SemrushBot/, "Semrush"],
  [/^DataForSeoBot/, "DataForSEO"],
  [/^Amazonbot/, "Amazon"],
  [/^Meta AI|^facebookexternalhit/, "Meta"],
  [/^Slackbot/, "Slack"],
  [/^Discordbot/, "Discord"],
  [/^TelegramBot/, "Telegram"],
  [/^LinkedInBot/, "LinkedIn"],
  [/^Redditbot/, "Reddit"],
  [/^YandexBot/, "Yandex"],
  [/^Baiduspider/, "Baidu"],
  [/^PerplexityBot/, "Perplexity"],
  [/^WhatsApp/, "WhatsApp"],
  [/^DuckDuck/, "DuckDuckGo"],
  [/^Cohere/, "Cohere"],
  [/^Mistral/, "Mistral"],
  [/^Diffbot/, "Diffbot"],
  [/^BLEXBot/, "WebMeUp"],
  [/^Lighthouse|^Headless Chrome/, "Headless browsers"],
];

export function companyOf(h: Hit): string | null {
  if (h.l === "human") return null;
  const paren = h.n.match(/\(([^)]+)\)$/);
  if (paren) return paren[1];
  for (const [re, name] of BY_NAME) if (re.test(h.n)) return name;
  const from = h.n.match(/" from (.+)$/);
  if (from) return from[1];
  if (h.l === "ghost") return h.o ? `Someone on ${h.o}` : "Unknown browsers";
  if (h.l === "script") return h.o ? `Scripts on ${h.o}` : "Anonymous scripts";
  return h.n;
}

export type Watcher = { name: string; first: Hit; count: number };

/** Companies in order of their first runner, among the given hits. */
export function watchers(hits: Hit[]): Watcher[] {
  const m = new Map<string, Watcher>();
  for (const h of hits) {
    const c = companyOf(h);
    if (!c) continue;
    const w = m.get(c);
    if (w) w.count++;
    else m.set(c, { name: c, first: h, count: 1 });
  }
  return [...m.values()].sort((a, b) => a.first.t - b.first.t);
}
