"use client";

import { useEffect, useState } from "react";

type Delegation = { id: string; title: string; status: string; specialist: { label: string; agentName?: string; authority: string } };
type Orchestration = { id: string; objective: string; status: string; delegations: Delegation[] };

export default function LeoOrchestrationStatus({ open, sessionId }: { open: boolean; sessionId?: string | null }) {
  const [orchestration, setOrchestration] = useState<Orchestration | null>(null);
  useEffect(() => {
    if (!open || !sessionId) return;
    let canceled = false;
    async function load() {
      try {
        const response = await fetch("/api/leo/orchestration", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "refresh", sessionId }), cache: "no-store" });
        if (response.status === 404) { if (!canceled) setOrchestration(null); return; }
        const payload = await response.json().catch(() => ({}));
        if (!canceled && response.ok && payload.orchestration) setOrchestration(payload.orchestration as Orchestration);
      } catch {}
    }
    void load();
    const timer = window.setInterval(load, 5000);
    return () => { canceled = true; window.clearInterval(timer); };
  }, [open, sessionId]);

  if (!orchestration || ["completed", "canceled"].includes(orchestration.status)) return null;
  const completed = orchestration.delegations.filter((item) => item.status === "completed").length;
  return <section className="mx-3 mt-2 rounded-xl border border-violet-300/15 bg-violet-400/[0.035] px-3 py-2.5" aria-label="Leo multi-agent orchestration">
    <div className="flex items-center justify-between gap-2"><strong className="text-[10px] text-violet-100">Multi-agent operation</strong><span className="text-[8px] font-bold uppercase tracking-wider text-violet-300">{orchestration.status}</span></div>
    <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-slate-400">{orchestration.objective}</p>
    <div className="mt-2 flex flex-wrap gap-1.5">{orchestration.delegations.map((item) => <span key={item.id} title={item.title} className={`rounded-md border px-2 py-1 text-[8px] ${item.status === "completed" ? "border-emerald-400/20 text-emerald-300" : item.status === "blocked" ? "border-rose-400/20 text-rose-300" : item.status === "waiting_approval" ? "border-amber-300/20 text-amber-200" : "border-white/10 text-slate-300"}`}>{item.specialist.agentName || item.specialist.label} · {item.status.replaceAll("_", " ")}</span>)}</div>
    <div className="mt-2 text-[8px] text-slate-500">{completed}/{orchestration.delegations.length} delegated steps completed · consequential actions remain task approval-gated</div>
  </section>;
}
