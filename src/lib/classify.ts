import { Resolver } from "node:dns/promises";
import { isIP } from "node:net";
import type { Hit, LaneId } from "./lanes";

// Who opened the link? We only use what the request gives us: the user agent
// (anyone can fake it), the reverse DNS name of the IP and the network (ASN)
// that owns the IP. A bot is "verified" only when its network matches its claim.

type Rule = { re: RegExp; name: string; lane: LaneId; rdns?: RegExp; org?: RegExp };

const RULES: Rule[] = [
  // X itself
  { re: /twitterbot/i, name: "Twitterbot", lane: "x", rdns: /twttr\.com$|twitter\.com$/i, org: /twitter|x corp/i },
  { re: /xai-|grok/i, name: "Grok (xAI)", lane: "ai", org: /x\.ai|xai|twitter/i },
  // AI crawlers and AI agents fetching on behalf of a user
  { re: /OAI-SearchBot/i, name: "OAI-SearchBot (OpenAI)", lane: "ai", org: /openai|microsoft/i },
  { re: /ChatGPT-User/i, name: "ChatGPT-User (OpenAI)", lane: "ai", org: /openai|microsoft/i },
  { re: /GPTBot/i, name: "GPTBot (OpenAI)", lane: "ai", org: /openai|microsoft/i },
  { re: /ClaudeBot|Claude-User|Claude-SearchBot|anthropic-ai/i, name: "ClaudeBot (Anthropic)", lane: "ai", org: /anthropic|google|amazon/i },
  { re: /PerplexityBot|Perplexity-User/i, name: "PerplexityBot", lane: "ai", org: /perplexity|amazon|cloudflare/i },
  { re: /Bytespider|TikTokSpider/i, name: "Bytespider (ByteDance)", lane: "ai", org: /bytedance|byteplus|tiktok/i },
  { re: /meta-externalagent|meta-externalfetcher|FacebookBot/i, name: "Meta AI crawler", lane: "ai", rdns: /fbsv\.net$|facebook\.com$|tfbnw\.net$/i, org: /facebook|meta/i },
  { re: /Amazonbot/i, name: "Amazonbot", lane: "ai", rdns: /amazonbot\.amazon$/i, org: /amazon/i },
  { re: /Applebot-Extended/i, name: "Applebot-Extended", lane: "ai", rdns: /applebot\.apple\.com$/i, org: /apple/i },
  { re: /CCBot/i, name: "CCBot (Common Crawl)", lane: "ai", org: /amazon/i },
  { re: /cohere-ai|cohere-training/i, name: "Cohere", lane: "ai" },
  { re: /MistralAI-User/i, name: "Mistral", lane: "ai" },
  { re: /DuckAssistBot/i, name: "DuckAssistBot", lane: "ai" },
  { re: /YouBot/i, name: "YouBot (You.com)", lane: "ai" },
  { re: /Diffbot/i, name: "Diffbot", lane: "ai" },
  { re: /Google-Extended|GoogleOther|Google-CloudVertexBot/i, name: "Google AI fetcher", lane: "ai", rdns: /google\.com$|googlebot\.com$/i, org: /google/i },
  { re: /PetalBot/i, name: "PetalBot (Huawei)", lane: "ai", org: /huawei/i },
  { re: /ImagesiftBot|Timpibot|omgili|Kangaroo Bot|AI2Bot|Ai2Bot|iaskspider|ICC-Crawler|img2dataset|Scrapy/i, name: "AI dataset crawler", lane: "ai" },
  // Search engines
  { re: /Googlebot|Google-InspectionTool|AdsBot-Google|Mediapartners-Google|APIs-Google|Storebot-Google/i, name: "Googlebot", lane: "search", rdns: /googlebot\.com$|google\.com$|googleusercontent\.com$/i, org: /google/i },
  { re: /bingbot|BingPreview|msnbot/i, name: "Bingbot", lane: "search", rdns: /search\.msn\.com$/i, org: /microsoft/i },
  { re: /Applebot/i, name: "Applebot", lane: "search", rdns: /applebot\.apple\.com$/i, org: /apple/i },
  { re: /YandexBot|YandexRenderResourcesBot|Yandex/i, name: "YandexBot", lane: "search", rdns: /yandex\.(ru|net|com)$/i, org: /yandex/i },
  { re: /DuckDuckBot|DuckDuckGo-Favicons/i, name: "DuckDuckBot", lane: "search" },
  { re: /Baiduspider/i, name: "Baiduspider", lane: "search", rdns: /baidu\.(com|jp)$/i, org: /baidu/i },
  { re: /SeznamBot|Qwantbot|MojeekBot|Sogou|360Spider|Yeti\/|coccocbot|Naver/i, name: "Small search engine", lane: "search" },
  // SEO and data tools
  { re: /AhrefsBot|AhrefsSiteAudit/i, name: "AhrefsBot", lane: "seo", rdns: /ahrefs\.(com|net)$/i, org: /ahrefs/i },
  { re: /SemrushBot|SiteAuditBot|SplitSignalBot/i, name: "SemrushBot", lane: "seo", rdns: /semrush\.com$/i },
  { re: /MJ12bot/i, name: "MJ12bot (Majestic)", lane: "seo" },
  { re: /DotBot/i, name: "DotBot (Moz)", lane: "seo" },
  { re: /rogerbot/i, name: "Rogerbot (Moz)", lane: "seo" },
  { re: /DataForSeoBot/i, name: "DataForSeoBot", lane: "seo" },
  { re: /BLEXBot/i, name: "BLEXBot", lane: "seo" },
  { re: /serpstatbot|SEOkicks|Screaming Frog|barkrowler|Seekport|linkdexbot|SemanticScholarBot|Barkrowler|MegaIndex|ZoominfoBot|CensysInspect|Expanse|BrandVerity|Linkfluence|Brandwatch|Meltwater|Talkwalker|Mention|Pulsar|Awario|NetcraftSurvey/i, name: "Data & monitoring crawler", lane: "seo" },
  // Link previews from other apps
  { re: /facebookexternalhit|facebookcatalog/i, name: "facebookexternalhit (Meta)", lane: "social", rdns: /fbsv\.net$|facebook\.com$|tfbnw\.net$/i, org: /facebook|meta/i },
  { re: /Slackbot|Slack-ImgProxy/i, name: "Slackbot", lane: "social", org: /slack|amazon/i },
  { re: /Discordbot/i, name: "Discordbot", lane: "social", org: /discord|google|cloudflare/i },
  { re: /TelegramBot/i, name: "TelegramBot", lane: "social", org: /telegram/i },
  { re: /WhatsApp/i, name: "WhatsApp", lane: "social", rdns: /fbsv\.net$|whatsapp\.net$/i, org: /facebook|meta|whatsapp/i },
  { re: /LinkedInBot/i, name: "LinkedInBot", lane: "social", org: /linkedin|microsoft/i },
  { re: /redditbot/i, name: "Redditbot", lane: "social", org: /reddit|fastly|google/i },
  { re: /Pinterest/i, name: "Pinterestbot", lane: "social" },
  { re: /Bluesky|Cardyb/i, name: "Bluesky preview", lane: "social" },
  { re: /Mastodon|Akkoma|Pleroma|Misskey/i, name: "Fediverse preview", lane: "social" },
  { re: /SkypeUriPreview|Teams|Iframely|Embedly|vkShare|Viber|Snapchat|Line\/|KakaoTalk|Zalo|Signal|Threads|Instagram/i, name: "Chat app preview", lane: "social" },
  { re: /Google-PageRenderer|Google Web Preview|Google-Read-Aloud/i, name: "Google preview", lane: "social", org: /google/i },
];

const SCRIPT_RE = /^(curl|wget|python-requests|python-urllib|python-httpx|aiohttp|httpx|Go-http-client|okhttp|axios|node-fetch|undici|node|got|Java|Apache-HttpClient|libwww-perl|Ruby|Faraday|PHP|GuzzleHttp|Dart|Deno|Bun|reqwest|HTTPie|Wget|RestSharp|Typhoeus|colly|Mechanize|feedparser|Feedly|Inoreader|Superfeedr)/i;
const BOTWORD_RE = /([A-Za-z0-9][A-Za-z0-9._-]*(?:bot|crawler|spider|scraper|fetcher|monitor|preview|checker|scanner|agent)[A-Za-z0-9._-]*)/i;
const BROWSER_RE = /Mozilla\/5\.0.*((Chrome|Safari|Firefox|Edg|OPR)\/|AppleWebKit\/.*Mobile\/)/;
const HEADLESS_RE = /HeadlessChrome|PhantomJS|Puppeteer|Playwright|Lighthouse|Chrome-Lighthouse|Electron/i;
// Hosting and cloud networks. A "browser" from here is almost certainly a bot.
const DATACENTER_RE =
  /amazon|aws|google|microsoft|azure|digitalocean|hetzner|ovh|linode|akamai|vultr|choopa|constant|oracle|alibaba|aliyun|tencent|huawei|cloudflare|leaseweb|contabo|scaleway|online s\.a\.s|m247|datacamp|hostinger|fastly|zenlayer|colocrossing|psychz|g-core|gcore|kamatera|ionos|1&1|hostwinds|interserver|quadranet|servers\.com|hurricane|equinix|limestone|netcup|frantech|ponynet|buyvm|tzulo|ipxo|cdn77|datapacket|oneprovider|clouvider|serverion|bytedance|byteplus|baidu|yandex|selectel|timeweb|aeza|hostkey|hosting|datacenter|data center|cloud|server|vps|colo|facebook|meta platforms|twitter/i;

const resolver = new Resolver({ timeout: 700, tries: 1 });

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(fallback);
      },
    );
  });
}

function expand6(ip: string): string {
  const [head, tail = ""] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const fill = new Array(8 - h.length - t.length).fill("0");
  return [...h, ...(ip.includes("::") ? fill : []), ...t].map((g) => g.padStart(4, "0")).join("");
}

function cymruName(ip: string): string | null {
  const v = isIP(ip);
  if (v === 4) return ip.split(".").reverse().join(".") + ".origin.asn.cymru.com";
  if (v === 6) return expand6(ip).split("").reverse().join(".") + ".origin6.asn.cymru.com";
  return null;
}

const asnNames = new Map<string, string>();

const PRETTY: [RegExp, string][] = [
  [/twitter|x corp/i, "X Corp"],
  [/^amazon|aws/i, "Amazon AWS"],
  [/google/i, "Google"],
  [/microsoft/i, "Microsoft"],
  [/facebook|meta/i, "Meta"],
  [/apple/i, "Apple"],
  [/cloudflare/i, "Cloudflare"],
  [/digitalocean/i, "DigitalOcean"],
  [/hetzner/i, "Hetzner"],
  [/^ovh/i, "OVH"],
  [/akamai|linode/i, "Akamai Linode"],
  [/oracle/i, "Oracle Cloud"],
  [/alibaba|aliyun/i, "Alibaba Cloud"],
  [/tencent/i, "Tencent Cloud"],
  [/bytedance|byteplus/i, "ByteDance"],
  [/huawei/i, "Huawei Cloud"],
  [/yandex/i, "Yandex"],
  [/ahrefs/i, "Ahrefs"],
  [/telegram/i, "Telegram"],
  [/linkedin/i, "LinkedIn"],
  [/vultr|choopa|constant/i, "Vultr"],
  [/fastly/i, "Fastly"],
];

function prettyOrg(raw: string): string {
  for (const [re, name] of PRETTY) if (re.test(raw)) return name;
  // "COMCAST-7922 - Comcast Cable Communications, LLC, US" -> "Comcast Cable Communications"
  let s = raw.includes(" - ") ? raw.split(" - ").slice(1).join(" - ") : raw;
  s = s.replace(/,\s*[A-Z]{2}$/, "").replace(/,?\s*(inc\.?|llc|ltd\.?|limited|corp\.?|corporation|gmbh|s\.a\.s?\.?|b\.v\.)$/i, "").trim();
  return s.length > 34 ? s.slice(0, 33) + "." : s;
}

async function lookupAsn(ip: string, hint?: string): Promise<{ asn: string; org: string; raw: string } | null> {
  let asn = hint && /^\d+$/.test(hint) ? hint : "";
  if (!asn) {
    const q = cymruName(ip);
    if (!q) return null;
    const rec = await withTimeout(resolver.resolveTxt(q), 800, [] as string[][]);
    const first = rec[0]?.join("") || "";
    asn = first.split("|")[0]?.trim().split(" ")[0] || "";
  }
  if (!asn) return null;
  let raw = asnNames.get(asn);
  if (!raw) {
    const r2 = await withTimeout(resolver.resolveTxt(`AS${asn}.asn.cymru.com`), 700, [] as string[][]);
    raw = (r2[0]?.join("") || "").split("|").pop()?.trim() || `AS${asn}`;
    asnNames.set(asn, raw);
  }
  return { asn, org: prettyOrg(raw), raw };
}

async function lookupRdns(ip: string): Promise<string | null> {
  if (!isIP(ip)) return null;
  const names = await withTimeout(resolver.reverse(ip), 800, [] as string[]);
  return names[0] || null;
}

function shortUa(ua: string): string {
  return ua.length > 140 ? ua.slice(0, 139) + "." : ua;
}

export async function classify(ua: string, ip: string, method: string, t: number, s: number, asnHint?: string, country?: string): Promise<Hit> {
  const [asn, host] = await Promise.all([lookupAsn(ip, asnHint), lookupRdns(ip)]);
  const org = asn?.org;
  const rawOrg = asn?.raw || "";
  const base = { s, t, ...(method !== "GET" ? { m: method } : {}) };

  const rule = RULES.find((r) => r.re.test(ua));
  if (rule) {
    const v = (rule.rdns && host && rule.rdns.test(host)) || (rule.org && rule.org.test(rawOrg)) ? 1 : 0;
    return { ...base, l: rule.lane, n: rule.name, v, o: org, h: host || undefined, u: shortUa(ua) };
  }

  // Anything from X's own network counts as X, whatever it says it is.
  if (/twitter|x corp/i.test(rawOrg)) {
    return { ...base, l: "x", n: BROWSER_RE.test(ua) ? "X (browser engine)" : "X infrastructure", v: 1, o: org, h: host || undefined, u: shortUa(ua) };
  }

  if (!ua.trim()) return { ...base, l: "script", n: "No user agent at all", v: 0, o: org, h: host || undefined };

  const script = ua.match(SCRIPT_RE);
  if (script) return { ...base, l: "script", n: script[1], v: 0, o: org, h: host || undefined, u: shortUa(ua) };

  if (HEADLESS_RE.test(ua)) {
    const n = /Lighthouse/i.test(ua) ? "Lighthouse" : "Headless Chrome";
    return { ...base, l: "ghost", n, v: 0, o: org, h: host || undefined, u: shortUa(ua) };
  }

  if (BROWSER_RE.test(ua)) {
    const bw = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : "Safari";
    const named = ua.match(BOTWORD_RE);
    if (named && !/Mobile Safari/.test(named[1])) {
      return { ...base, l: "script", n: named[1].slice(0, 40), v: 0, o: org, h: host || undefined, u: shortUa(ua) };
    }
    // iCloud Private Relay sends real Safari users out through Akamai, Cloudflare and Fastly.
    const relay = /iPhone|iPad|Mac OS X/.test(ua) && !/Chrome|CriOS|Firefox|Edg/.test(ua) && /akamai|cloudflare|fastly/i.test(rawOrg);
    if (org && DATACENTER_RE.test(rawOrg) && !relay) {
      return { ...base, l: "ghost", n: `"${bw}" on ${org}`, v: 0, o: org, h: host || undefined, u: shortUa(ua) };
    }
    // Humans: no host, no user agent, only the network owner.
    const dev = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "browser";
    const inX = /Twitter|TwitterAndroid/i.test(ua) ? " in the X app" : "";
    return { ...base, l: "human", n: `Human on ${dev}${inX}`, v: 0, o: relay ? "iCloud Private Relay" : org, ...(country ? { c: country } : {}) };
  }

  const named = ua.match(BOTWORD_RE);
  const n = named ? named[1].slice(0, 40) : ua.split(/[\s/;(]/)[0].slice(0, 32) || "Unknown";
  return { ...base, l: "script", n, v: 0, o: org, h: host || undefined, u: shortUa(ua) };
}

export function clientIp(h: Headers): string {
  const xff = h.get("x-forwarded-for") || "";
  return (xff.split(",")[0] || h.get("x-real-ip") || "").trim();
}
