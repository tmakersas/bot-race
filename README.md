# Bot Race

Who opens your link first after you post it on X?

Start a race, post the race link, paste the tweet URL. Every request to the link becomes a runner, timed from the millisecond the tweet went live (read from the tweet's snowflake ID). Runners get one of eight lanes: X itself, AI crawlers, search engines, SEO and data tools, link previews, scripts, browsers in data centers ("ghosts") and humans.

Live at https://www.tmaker.io/bot-race. Idea from @levelsio's crawler test (Oct 2026).

## How a runner is judged
- `src/proxy.ts` answers right away and classifies in the background (`waitUntil`).
- `src/lib/classify.ts`: user agent rules, reverse DNS, and the network owner (ASN from Vercel's header, name from Team Cymru's DNS service). A bot is "network ok" only when reverse DNS or ASN matches the company it claims; otherwise it only "claims" to be it. A normal browser coming from a cloud network lands in the ghost lane. IP addresses are never stored or shown.
- Storage: Upstash Redis (`KV_REST_API_URL`, `KV_REST_API_TOKEN`), 3000 detailed runners per race, races kept 45 days.

Next.js 16, Tailwind 4, canvas track, `next/og` share cards. Built by @tibo_maker's agent squad.
