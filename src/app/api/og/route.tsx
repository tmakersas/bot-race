import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { LANES, type Hit } from "@/lib/lanes";
import { getHits, getRace } from "@/lib/store";
import { fmtSecs } from "@/lib/time";

const font = (f: string) => readFile(join(process.cwd(), "assets", f));

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const [anton, mono, monoB] = await Promise.all([font("Anton-Regular.ttf"), font("SpaceMono-Regular.ttf"), font("SpaceMono-Bold.ttf")]);
  const fonts = [
    { name: "Anton", data: anton, weight: 400 as const },
    { name: "Mono", data: mono, weight: 400 as const },
    { name: "Mono", data: monoB, weight: 700 as const },
  ];
  const id = sp.get("r");
  const race = id ? await getRace(id).catch(() => null) : null;

  if (!race) {
    const gate = sp.get("gate");
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#07080a", color: "#f2f0e9", fontFamily: "Mono", position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 1200, height: 360, display: "flex", background: "linear-gradient(180deg, rgba(184,255,61,0.16), rgba(184,255,61,0))" }} />
          <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: 0, top: 284, width: 1200 }}>
            {LANES.map((l, i) => (
              <div key={l.id} style={{ display: "flex", alignItems: "center", height: 37, borderTop: "1px dashed rgba(255,255,255,0.10)", background: i % 2 ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.035)" }}>
                <div style={{ width: 6, height: 22, background: l.color, marginLeft: 0 }} />
                <span style={{ fontSize: 16, marginLeft: 18, color: l.color, letterSpacing: 2, width: 330 }}>{`${i + 1}  ${l.label.toUpperCase()}`}</span>
                <div style={{ width: 2, height: 37, background: "rgba(242,240,233,0.6)" }} />
                <div style={{ display: "flex", marginLeft: 40 + ((i * 97) % 380), width: 12, height: 12, borderRadius: 6, background: l.color, boxShadow: `0 0 18px ${l.color}` }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "40px 56px 0", fontSize: 20, letterSpacing: 3, color: "rgba(242,240,233,0.6)" }}>
            <span style={{ fontFamily: "Anton", fontSize: 34, letterSpacing: 2, color: "#f2f0e9" }}>BOT RACE</span>
            <span style={{ display: "flex", alignItems: "center" }}>
              <div style={{ width: 14, height: 14, borderRadius: 7, background: "#ff5a36", marginRight: 12 }} />
              {gate ? `LIVE · RACE ${gate.toUpperCase()}` : "WHO OPENS YOUR LINK FIRST?"}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", padding: "18px 56px 0" }}>
            <span style={{ fontFamily: "Anton", fontSize: 96, lineHeight: 1, letterSpacing: 1 }}>THIS LINK IS A RACETRACK.</span>
            <span style={{ fontSize: 26, marginTop: 14, color: "rgba(242,240,233,0.75)" }}>{gate ? "The bots are already running. First human to click gets their name on the board." : "Every bot that opens your link, timed and named. Then the humans fight for first."}</span>
          </div>
          <div style={{ display: "flex", position: "absolute", bottom: 0, left: 0, width: 1200, height: 44, alignItems: "center", justifyContent: "space-between", padding: "0 56px", background: "#b8ff3d", color: "#07080a", fontSize: 20, fontWeight: 700 }}>
            <span>tmaker.io/bot-race</span>
            <span>X · AI · SEARCH · SEO · PREVIEWS · SCRIPTS · GHOSTS · HUMANS</span>
          </div>
        </div>
      ),
      { width: 1200, height: 630, fonts, headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
    );
  }

  // Photo finish
  const hits: Hit[] = (await getHits(race.id, 0, 499).catch(() => [])).sort((a, b) => a.t - b.t);
  const origin = race.t0 ?? hits.find((h) => h.l === "x")?.t ?? hits[0]?.t ?? race.created;
  const after = hits.filter((h) => h.t >= origin);
  const podium = after.filter((h) => h.l !== "x" && h.l !== "human").slice(0, 3);
  const humans = race.lanes.human || 0;
  const bots = race.count - humans;
  const max = Math.max(1, ...LANES.map((l) => race.lanes[l.id] || 0));
  const firstHuman = after.find((h) => h.l === "human");

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#07080a", color: "#f2f0e9", fontFamily: "Mono", padding: "36px 52px", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 1200, height: 300, display: "flex", background: "linear-gradient(180deg, rgba(184,255,61,0.13), rgba(184,255,61,0))" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, letterSpacing: 3, color: "rgba(242,240,233,0.6)" }}>
          <span style={{ fontFamily: "Anton", fontSize: 30, letterSpacing: 2, color: "#f2f0e9" }}>BOT RACE · PHOTO FINISH</span>
          <span>{race.label ? race.label.toUpperCase().slice(0, 30) : `RACE ${race.id.toUpperCase()}`}</span>
        </div>
        <div style={{ display: "flex", marginTop: 18, gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", width: 470 }}>
            <span style={{ fontSize: 18, color: "rgba(242,240,233,0.55)", letterSpacing: 2 }}>BOTS THAT OPENED ONE LINK</span>
            <span style={{ fontFamily: "Anton", fontSize: 170, lineHeight: 1, color: "#b8ff3d" }}>{bots.toLocaleString("en-US")}</span>
            <span style={{ fontSize: 20, color: "rgba(242,240,233,0.75)", marginTop: 8 }}>
              {humans ? `${humans.toLocaleString("en-US")} humans` : "no humans yet"}
              {firstHuman ? `, first at ${fmtSecs(firstHuman.t - origin)}` : ""}
            </span>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 22 }}>
              {podium.map((h, i) => (
                <div key={h.s} style={{ display: "flex", alignItems: "center", fontSize: 20, marginTop: 8 }}>
                  <span style={{ width: 44, fontFamily: "Anton", fontSize: 28, color: i === 0 ? "#ffe14d" : "rgba(242,240,233,0.6)" }}>{`${i + 1}.`}</span>
                  <span style={{ display: "flex", flex: 1 }}>{h.n.length > 24 ? h.n.slice(0, 23) + "." : h.n}</span>
                  <span style={{ fontWeight: 700, color: "#b8ff3d" }}>{fmtSecs(h.t - origin)}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, marginTop: 6 }}>
            {LANES.map((l) => {
              const n = race.lanes[l.id] || 0;
              const lead = after.find((h) => h.l === l.id);
              return (
                <div key={l.id} style={{ display: "flex", flexDirection: "column", marginBottom: 9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, color: l.color, letterSpacing: 1 }}>
                    <span>{l.label.toUpperCase()}</span>
                    <span>{lead ? fmtSecs(lead.t - origin) : "-"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", marginTop: 4 }}>
                    <div style={{ display: "flex", height: 14, width: Math.max(4, Math.round((n / max) * 470)), background: l.color, borderRadius: 3 }} />
                    <span style={{ fontSize: 16, marginLeft: 10 }}>{n.toLocaleString("en-US")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto", fontSize: 18, color: "rgba(242,240,233,0.55)" }}>
          <span>{race.t0 ? "timed from the tweet's own timestamp" : "timed from X's first visit"}</span>
          <span style={{ color: "#f2f0e9" }}>tmaker.io/bot-race</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts, headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
  );
}
