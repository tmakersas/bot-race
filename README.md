# Bot Race

Who opens your link first after you post it on X?

v2 (2026-10-09): the homepage is itself a live race. Every visit to tmaker.io/bot-race is a runner in today's race (UTC), so visitors instantly see how many bots got there before them, and the first human of the day can claim the spot with their X handle. On any race link, humans race the bots and each other: claims are tied to a signed runner cookie, so only the browser that crossed the line can claim it. Boards: fastest humans ever (time from the tweet), bot magnets (most bots in the first 10 minutes, races with a pasted tweet), fastest bots. "Who's watching" lists the companies that read the link before you did.

Start a race and post the link. The clock starts at X's first visit; pasting the tweet URL is optional and moves the clock to the tweet's own millisecond. Every request to the link becomes a runner, timed from the millisecond the tweet went live (read from the tweet's snowflake ID). Runners get one of eight lanes: X itself, AI crawlers, search engines, SEO and data tools, link previews, scripts, browsers in data centers ("ghosts") and humans.

Live at https://www.tmaker.io/bot-race. Idea from @levelsio's crawler test (Oct 2026).

## How a runner is judged
- `src/proxy.ts` answers right away and classifies in the background (`waitUntil`).
- `src/lib/classify.ts`: user agent rules, reverse DNS, and the network owner (ASN from Vercel's header, name from Team Cymru's DNS service). A bot is "network ok" only when reverse DNS or ASN matches the company it claims; otherwise it only "claims" to be it. A normal browser coming from a cloud network lands in the ghost lane. IP addresses are never stored or shown.
- Storage: Upstash Redis (`KV_REST_API_URL`, `KV_REST_API_TOKEN`), 3000 detailed runners per race, races kept 45 days.

Next.js 16, Tailwind 4, canvas track, `next/og` share cards. Built by @tibo_maker's agent squad.
