// X status ids are snowflakes: the top bits are milliseconds since 2010-11-04.
export function tweetTime(input: string): { id: string; t: number } | null {
  const m = input.trim().match(/(?:status(?:es)?\/)?(\d{15,20})(?:\D|$)/);
  if (!m) return null;
  const id = m[1];
  const t = Number((BigInt(id) >> BigInt(22)) + BigInt(1288834974657));
  if (!Number.isFinite(t) || t < 1600000000000) return null;
  return { id, t };
}

/** 0.4 -> "0.40s", 8.4 -> "8.40s", 41.2 -> "41.2s", 192 -> "3m 12s", 7300 -> "2h 01m" */
export function fmtSecs(ms: number): string {
  const neg = ms < 0;
  const s = Math.abs(ms) / 1000;
  let out: string;
  if (s < 10) out = s.toFixed(2) + "s";
  else if (s < 60) out = s.toFixed(1) + "s";
  else if (s < 3600) out = `${Math.floor(s / 60)}m ${String(Math.floor(s % 60)).padStart(2, "0")}s`;
  else if (s < 86400) out = `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
  else out = `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
  return (neg ? "-" : "") + out;
}

/** Big race clock: "00:08.40", "03:12.4", "1:02:05" */
export function fmtClock(ms: number): string {
  const neg = ms < 0;
  const s = Math.abs(ms) / 1000;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pre = neg ? "-" : "";
  if (h > 0) return `${pre}${h}:${String(m).padStart(2, "0")}:${String(Math.floor(sec)).padStart(2, "0")}`;
  return `${pre}${String(m).padStart(2, "0")}:${sec.toFixed(2).padStart(5, "0")}`;
}
