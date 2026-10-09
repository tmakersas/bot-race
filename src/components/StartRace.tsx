"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BASE } from "@/lib/site";

export default function StartRace({ big }: { big?: boolean }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setErr(null);
    const r = await fetch(`${BASE}/api/race`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.id) {
      setBusy(false);
      return setErr(d.error || "Could not open the gates. Try again.");
    }
    localStorage.setItem(`br_k_${d.id}`, d.key);
    // Your own visits to your race are not runners.
    const prev = (document.cookie.match(/(?:^|; )br_o=([^;]*)/)?.[1] || "").split(".").filter(Boolean).slice(-20);
    document.cookie = `br_o=${[...prev, d.id].join(".")}; path=${BASE}; max-age=${60 * 60 * 24 * 60}; samesite=lax`;
    router.push(`/r/${d.id}`);
  };
  return (
    <div id="start" className={`flex w-full flex-col gap-2 sm:flex-row ${big ? "max-w-xl" : ""}`}>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={40}
        placeholder="Name your race (optional)"
        className="flex-1 rounded-xl border border-white/15 bg-black/40 px-4 py-3.5 text-[15px] text-chalk placeholder:text-white/35 focus:border-hype focus:outline-none"
      />
      <button onClick={go} disabled={busy} className="rounded-xl bg-hype px-6 py-3.5 text-[15px] font-semibold text-ink shadow-[0_0_40px_-8px_rgba(184,255,61,0.7)] transition hover:brightness-110 disabled:opacity-60">
        {busy ? "Opening the gates..." : "Start a race"}
      </button>
      {err && <p className="text-sm text-flag sm:hidden">{err}</p>}
    </div>
  );
}
