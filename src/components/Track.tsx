"use client";

import { useEffect, useRef, useState } from "react";
import { LANES, LANE_INDEX, type Hit } from "@/lib/lanes";
import { fmtSecs } from "@/lib/time";

// The racetrack. Canvas, because a popular race has thousands of runners.
// X axis is log time since the gun: 0.1s, 1s, 10s, 1m, 10m, 1h. False starts
// (requests before the tweet existed) sit in the gate on the left.

type Props = {
  hits: Hit[];
  origin: number;
  clockRef: React.MutableRefObject<number>; // race time currently shown (ms since origin)
  mine?: number | null; // server time of the viewer's own hit
  compact?: boolean;
  appear: Map<number, number>; // seq -> performance.now() when it appeared on screen
};

const MIN = 100; // 0.1s
const LOG_MIN = Math.log10(MIN);

function hash(n: number) {
  let x = n * 2654435761;
  x ^= x >>> 15;
  return ((x >>> 0) % 1000) / 1000;
}

export default function Track({ hits, origin, clockRef, mine, compact, appear }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef({ hits, origin, mine, appear });
  state.current = { hits, origin, mine, appear };
  const [w, setW] = useState(0);
  const [tip, setTip] = useState<{ x: number; y: number; h: Hit } | null>(null);
  const geo = useRef({ gutter: 0, gate: 0, laneH: 0, top: 0, width: 0, maxT: 3600_000 });

  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const mobile = w < 640;
  const laneH = compact ? (mobile ? 30 : 34) : mobile ? 40 : 52;
  const top = 26;
  const height = top + LANES.length * laneH + 10;

  useEffect(() => {
    if (!w) return;
    const c = canvas.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * dpr;
    c.height = height * dpr;
    const ctx = c.getContext("2d")!;
    const MONO = (getComputedStyle(document.documentElement).getPropertyValue("--font-jb").trim() || "ui-monospace") + ", monospace";
    let raf = 0;

    const draw = () => {
      const { hits, origin, mine, appear } = state.current;
      const clock = clockRef.current;
      const now = performance.now();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, height);
      const gutter = mobile ? 8 : 150;
      const gate = mobile ? 30 : 56;
      const x0 = gutter + gate; // the starting gate line
      const x1 = w - 12;
      let maxT = 3600_000;
      for (const h of hits) maxT = Math.max(maxT, h.t - origin);
      maxT = Math.max(maxT, clock);
      const logMax = Math.log10(maxT);
      geo.current = { gutter, gate, laneH, top, width: w, maxT };
      const X = (ms: number) => {
        if (ms < 0) return gutter + gate * (1 - Math.min(1, Math.log10(1 + -ms / 100) / Math.log10(1 + 600)));
        if (ms < MIN) return x0 + (ms / MIN) * 6;
        return x0 + 6 + ((Math.log10(ms) - LOG_MIN) / (logMax - LOG_MIN)) * (x1 - x0 - 6);
      };

      // Lanes
      LANES.forEach((l, i) => {
        const y = top + i * laneH;
        ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.018)" : "rgba(255,255,255,0.035)";
        ctx.fillRect(gutter, y, w - gutter, laneH);
        ctx.strokeStyle = "rgba(255,255,255,0.07)";
        ctx.setLineDash([2, 6]);
        ctx.beginPath();
        ctx.moveTo(gutter, y + laneH);
        ctx.lineTo(w, y + laneH);
        ctx.stroke();
        ctx.setLineDash([]);
        if (!mobile) {
          ctx.fillStyle = l.color;
          ctx.fillRect(0, y + 8, 3, laneH - 16);
          ctx.font = "600 11px " + MONO;
          ctx.fillStyle = "rgba(242,240,233,0.92)";
          ctx.fillText(`${i + 1}  ${l.label.toUpperCase()}`, 12, y + laneH / 2 + 4);
        } else {
          ctx.font = "600 9px " + MONO;
          ctx.fillStyle = l.color;
          ctx.globalAlpha = 0.85;
          ctx.fillText(`${i + 1} ${l.short}`, gutter + 4, y + 11);
          ctx.globalAlpha = 1;
        }
      });

      // Gate and time grid
      ctx.fillStyle = "rgba(255,90,54,0.06)";
      ctx.fillRect(gutter, top, gate, LANES.length * laneH);
      ctx.strokeStyle = "rgba(242,240,233,0.65)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, top - 4);
      ctx.lineTo(x0, top + LANES.length * laneH);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.font = "500 10px " + MONO;
      ctx.fillStyle = "rgba(255,90,54,0.8)";
      if (!mobile) ctx.fillText("EARLY", gutter + 3, 14);
      ctx.fillStyle = "rgba(242,240,233,0.8)";
      ctx.fillText("GUN", x0 + 4, 14);
      const ticks: [number, string][] = [
        [1000, "1s"],
        [10_000, "10s"],
        [60_000, "1m"],
        [600_000, "10m"],
        [3600_000, "1h"],
        [6 * 3600_000, "6h"],
        [86400_000, "1d"],
        [7 * 86400_000, "1w"],
      ];
      for (const [ms, label] of ticks) {
        if (ms > maxT * 1.01) continue;
        const x = X(ms);
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, top + LANES.length * laneH);
        ctx.stroke();
        ctx.fillStyle = "rgba(242,240,233,0.45)";
        ctx.fillText(label, x - 6, 14);
      }

      // The clock line sweeping across
      const cx = X(clock);
      const grad = ctx.createLinearGradient(cx - 60, 0, cx, 0);
      grad.addColorStop(0, "rgba(184,255,61,0)");
      grad.addColorStop(1, "rgba(184,255,61,0.10)");
      ctx.fillStyle = grad;
      ctx.fillRect(Math.max(x0, cx - 60), top, Math.min(60, cx - x0), LANES.length * laneH);
      ctx.strokeStyle = "rgba(184,255,61,0.9)";
      ctx.beginPath();
      ctx.moveTo(cx, top - 6);
      ctx.lineTo(cx, top + LANES.length * laneH);
      ctx.stroke();

      // Runners
      const leaders = new Map<number, Hit>();
      let mineHit: { x: number; y: number } | null = null;
      for (const h of hits) {
        const ms = h.t - origin;
        if (ms > clock) continue;
        const li = LANE_INDEX[h.l];
        const x = X(ms);
        const y = top + li * laneH + laneH * (0.28 + 0.6 * hash(h.s));
        const color = LANES[li].color;
        const born = appear.get(h.s) ?? 0;
        const age = now - born;
        if (age < 700) {
          // Gallop in from the gate with a streak.
          const k = 1 - Math.pow(1 - Math.min(1, age / 450), 3);
          const hx = x0 + (x - x0) * k;
          const tg = ctx.createLinearGradient(x0, 0, hx, 0);
          tg.addColorStop(0, "rgba(0,0,0,0)");
          tg.addColorStop(1, color);
          ctx.strokeStyle = tg;
          ctx.globalAlpha = 0.55 * (1 - age / 700);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(Math.max(x0, hx - 140), y);
          ctx.lineTo(hx, y);
          ctx.stroke();
          ctx.lineWidth = 1;
          ctx.globalAlpha = 1;
          ctx.shadowColor = color;
          ctx.shadowBlur = 14;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(hx, y, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = color;
          ctx.globalAlpha = h.l === "human" ? 0.95 : 0.8;
          ctx.beginPath();
          ctx.arc(x, y, h.v ? 3 : 2.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        if (ms >= 0) {
          const cur = leaders.get(li);
          if (!cur || h.t < cur.t) leaders.set(li, h);
        }
        if (mine && Math.abs(h.t - mine) < 2 && h.l === "human") mineHit = { x, y };
      }

      // Lane leaders get a name tag.
      if (!compact || !mobile) {
        ctx.font = `500 ${mobile ? 9 : 10}px ${MONO}`;
        for (const [li, h] of leaders) {
          const ms = h.t - origin;
          const x = X(ms);
          const y = top + li * laneH + (mobile ? laneH - 5 : laneH / 2 + 4);
          const label = `${h.n.length > 22 ? h.n.slice(0, 21) + "." : h.n} ${fmtSecs(ms)}`;
          const tw = ctx.measureText(label).width;
          const lx = Math.min(x + 8, w - tw - 8);
          ctx.fillStyle = "rgba(7,8,10,0.78)";
          ctx.fillRect(lx - 3, y - 10, tw + 6, 13);
          ctx.fillStyle = LANES[li].color;
          ctx.fillText(label, lx, y);
        }
      }

      if (mineHit) {
        ctx.strokeStyle = "#ffe14d";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(mineHit.x, mineHit.y, 8 + 2 * Math.sin(now / 200), 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.font = "700 10px " + MONO;
        ctx.fillStyle = "#ffe14d";
        ctx.fillText("YOU", mineHit.x - 10, mineHit.y - 12);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [w, height, mobile, laneH, compact, clockRef]);

  // Tap or hover a runner to see who it is.
  const onMove = (e: React.PointerEvent) => {
    const rect = canvas.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const { gutter, gate, top, laneH, width, maxT } = geo.current;
    const x0 = gutter + gate;
    const x1 = width - 12;
    const logMax = Math.log10(maxT);
    const X = (ms: number) => {
      if (ms < 0) return gutter + gate * (1 - Math.min(1, Math.log10(1 + -ms / 100) / Math.log10(1 + 600)));
      if (ms < MIN) return x0 + (ms / MIN) * 6;
      return x0 + 6 + ((Math.log10(ms) - LOG_MIN) / (logMax - LOG_MIN)) * (x1 - x0 - 6);
    };
    let best: { d: number; h: Hit; x: number; y: number } | null = null;
    for (const h of state.current.hits) {
      const ms = h.t - state.current.origin;
      if (ms > clockRef.current) continue;
      const x = X(ms);
      const y = top + LANE_INDEX[h.l] * laneH + laneH * (0.28 + 0.6 * hash(h.s));
      const d = Math.hypot(x - px, y - py);
      if (d < 16 && (!best || d < best.d)) best = { d, h, x, y };
    }
    setTip(best ? { x: best.x, y: best.y, h: best.h } : null);
  };

  return (
    <div ref={wrap} className="relative w-full select-none">
      <canvas ref={canvas} style={{ width: "100%", height }} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setTip(null)} />
      {tip && (
        <div
          className="pointer-events-none absolute z-10 max-w-[260px] rounded-md border border-white/15 bg-black/90 px-3 py-2 font-mono text-[11px] leading-snug shadow-xl"
          style={{ left: Math.min(tip.x + 10, w - 270), top: tip.y + 12 }}
        >
          <div style={{ color: LANES[LANE_INDEX[tip.h.l]].color }} className="font-bold">
            #{tip.h.s} {tip.h.n}
          </div>
          <div className="text-white/70">
            {fmtSecs(tip.h.t - origin)} {tip.h.t - origin < 0 ? "before the tweet" : "after the gun"}
          </div>
          {tip.h.o && <div className="text-white/60">network: {tip.h.o}</div>}
          {tip.h.h && <div className="truncate text-white/45">{tip.h.h}</div>}
          {tip.h.l !== "human" && <div className={tip.h.v ? "text-[#b8ff3d]" : "text-white/45"}>{tip.h.v ? "network matches the name" : "claims to be (not verified)"}</div>}
        </div>
      )}
    </div>
  );
}
