import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { classify, clientIp } from "@/lib/classify";
import { signRunner } from "@/lib/sign";
import { ensureHouse, houseId, reserveSeq, saveHit } from "@/lib/store";

// Every full request to a race link is a runner. So is every visit to the
// homepage: that is today's race, open to everyone, clock from midnight UTC.
// We answer right away and classify in the background, so a bot never waits
// on our DNS lookups.
export function proxy(req: NextRequest, event: NextFetchEvent) {
  const t = Date.now();
  const path = req.nextUrl.pathname.replace(/^\/bot-race/, "") || "/";
  const m = path.match(/^\/r\/([a-z0-9]{5,12})\/?$/);
  const home = path === "/" || path === "";
  if (!m && !home) return NextResponse.next();
  const id = m ? m[1] : houseId(t);
  const h = req.headers;
  // Client-side navigations and prefetches are the app talking to itself.
  if (h.get("rsc") || h.get("next-router-prefetch") || h.get("next-router-state-tree") || h.get("purpose") === "prefetch") return NextResponse.next();
  if (m) {
    // The race owner watching their own race is not a runner.
    const owner = req.cookies.get("br_o")?.value || "";
    if (owner.split(".").includes(id)) return NextResponse.next();
    if (req.nextUrl.searchParams.has("k")) return NextResponse.next();
  }

  // A browser that already ran this race is a returning visitor, not a new runner.
  if (req.cookies.get(`br_me_${id}`)) return NextResponse.next();
  const ua = h.get("user-agent") || "";
  const ip = clientIp(h);
  const asnHint = h.get("x-vercel-ip-as-number") || undefined;
  const country = h.get("x-vercel-ip-country") || undefined;
  const res = NextResponse.next();
  // Signed, so a human can later claim their own spot and nobody else's.
  res.cookies.set(`br_me_${id}`, signRunner(id, t), { path: "/bot-race", maxAge: home ? 60 * 60 * 26 : 60 * 60 * 24 * 7, sameSite: "lax" });
  event.waitUntil(
    (async () => {
      try {
        if (home) await ensureHouse(id);
        const seq = await reserveSeq(id);
        if (!seq) return;
        const hit = await classify(ua, ip, req.method, t, seq.s, asnHint, country);
        await saveHit(id, hit, seq);
      } catch (e) {
        console.error("hit log failed", e);
      }
    })(),
  );
  return res;
}

export const config = {
  matcher: ["/", "/r/:id"],
};
