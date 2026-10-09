import { createHmac } from "node:crypto";

// The runner cookie says "I am the runner who arrived at time t". It is signed,
// so nobody can claim the first human spot by copying a time from the API.
const secret = "br-sign:" + (process.env.BR_SECRET || process.env.KV_REST_API_TOKEN || "dev-only");

export function signRunner(id: string, t: number): string {
  const sig = createHmac("sha256", secret).update(`${id}:${t}`).digest("base64url").slice(0, 22);
  return `${t}.${sig}`;
}

export function readRunner(id: string, value: string | undefined): number | null {
  if (!value) return null;
  const [ts] = value.split(".");
  const t = Number(ts);
  if (!Number.isFinite(t)) return null;
  return signRunner(id, t) === value ? t : null;
}
