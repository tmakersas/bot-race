import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { classify, clientIp } from "@/lib/classify";
import { reserveSeq, saveHit } from "@/lib/store";

// Every full request to a race link is a runner. We answer right away and
// classify in the background, so a bot never waits on our DNS lookups.
export function proxy(req: NextRequest, event: NextFetchEvent) {
  const t = Date.now();
  const m = req.nextUrl.pathname.match(/\/r\/([a-z0-9]{5,12})\/?$/);
  if (!m) return NextResponse.next();
  const id = m[1];
  const h = req.headers;
  // Client-side navigations and prefetches are the app talking to itself.
  if (h.get("rsc") || h.get("next-router-prefetch") || h.get("next-router-state-tree")) return NextResponse.next();
  // The race owner watching their own race is not a runner.
  const owner = req.cookies.get("br_o")?.value || "";
  if (owner.split(".").includes(id)) return NextResponse.next();
  if (req.nextUrl.searchParams.has("k")) return NextResponse.next();

  // A browser that already ran this race is a returning visitor, not a new runner.
  if (req.cookies.get(`br_me_${id}`)) return NextResponse.next();
  const ua = h.get("user-agent") || "";
  const ip = clientIp(h);
  const asnHint = h.get("x-vercel-ip-as-number") || undefined;
  const country = h.get("x-vercel-ip-country") || undefined;
  const res = NextResponse.next();
  // Lets a human find their own runner on the track.
  res.cookies.set(`br_me_${id}`, String(t), { path: "/bot-race", maxAge: 60 * 60 * 24 * 7, sameSite: "lax" });
  event.waitUntil(
    (async () => {
      try {
        const seq = await reserveSeq(id);
        if (!seq) return;
        const hit = await classify(ua, ip, req.method, t, seq.s, asnHint, country);
        await saveHit(id, hit, seq.t0);
      } catch (e) {
        console.error("hit log failed", e);
      }
    })(),
  );
  return res;
}

export const config = {
  matcher: "/r/:id",
};
