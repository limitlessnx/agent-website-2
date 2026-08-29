"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCircle2, Loader2, ShieldCheck, Wrench } from "@/components/admin/ServerIcons";

type AlertItem = {
  id: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  summary: string;
  lifecycle: "new" | "active" | "acknowledged" | "resolved";
  alertPolicy: { mode: "interrupt" | "surface" | "quiet"; reason: string; cooldownMinutes: number; deliver: boolean };
  analysis: { likelyCause: string; verifyNext: string[]; safeNextStep: string; consequenceBoundary: string };
  actionAvailable: boolean;
};

type MonitorResponse = { ok?: boolean; alerts?: AlertItem[]; error?: string };

export default function LeoProactiveAlerts({ open, sessionId, onCount }: { open: boolean; sessionId?: string | null; onCount?: (count: number, critical: number) => void }) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const marked = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/leo/monitor?limit=50", { cache: "no-store" });
      const data = await response.json().catch(() => ({})) as MonitorResponse;
      if (!response.ok) return;
      const next = Array.isArray(data.alerts) ? data.alerts : [];
      setAlerts(next);
      onCount?.(next.length, next.filter((item) => item.severity === "critical").length);
    } catch {}
  }, [onCount]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    const visible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", visible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    for (const alert of alerts) {
      if (marked.current.has(alert.id)) continue;
      marked.current.add(alert.id);
      void fetch("/api/leo/monitor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "mark_alerted", signalId: alert.id }) });
    }
  }, [alerts, open]);

  async function act(alert: AlertItem, action: "acknowledge" | "prepare_task") {
    setBusyId(alert.id); setMessage(null);
    try {
      const response = await fetch("/api/leo/monitor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, signalId: alert.id, sessionId: sessionId || undefined }) });
      const data = await response.json().catch(() => ({})) as { error?: string; task?: { id?: string } };
      if (!response.ok) throw new Error(data.error || "Leo could not update this signal.");
      setMessage(action === "prepare_task" ? "Controlled operational task prepared. Approval gates still apply." : "Signal acknowledged. Leo will suppress repeat alerts unless the condition is reopened.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update signal."); }
    finally { setBusyId(null); }
  }

  if (!open || !alerts.length) return null;
  return <section className="mx-3 mt-2 grid gap-2" aria-label="Leo proactive alerts">
    <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[9px] font-black tracking-[0.12em] text-violet-200"><Bell size={11} />PROACTIVE ATTENTION</span><span className="text-[8px] text-slate-500">{alerts.length} surfaced</span></div>
    {alerts.slice(0, 3).map((alert) => <article key={alert.id} className={`rounded-xl border p-3 ${alert.severity === "critical" ? "border-rose-400/25 bg-rose-400/[0.055]" : alert.severity === "high" ? "border-amber-300/20 bg-amber-300/[0.045]" : "border-violet-300/15 bg-violet-400/[0.035]"}`}>
      <div className="flex items-start justify-between gap-2"><div><span className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">{alert.severity} · {alert.category}</span><strong className="mt-1 block text-[11px] text-white">{alert.title}</strong></div><span className="rounded-md border border-white/10 px-1.5 py-1 text-[8px] text-slate-400">{alert.lifecycle}</span></div>
      <p className="mt-2 text-[9px] leading-4 text-slate-300">{alert.summary}</p>
      <p className="mt-2 text-[9px] leading-4 text-slate-400"><strong className="text-slate-200">Leo recommends:</strong> {alert.analysis.safeNextStep}</p>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button type="button" disabled={busyId === alert.id} onClick={() => void act(alert, "acknowledge")} className="inline-flex min-h-7 items-center gap-1 rounded-lg border border-white/10 px-2.5 text-[8px] font-bold text-slate-300 hover:bg-white/5 disabled:opacity-50"><CheckCircle2 size={10} />Acknowledge</button>
        {alert.actionAvailable ? <button type="button" disabled={busyId === alert.id || !sessionId} onClick={() => void act(alert, "prepare_task")} className="inline-flex min-h-7 items-center gap-1 rounded-lg bg-violet-600 px-2.5 text-[8px] font-black text-white hover:bg-violet-500 disabled:opacity-50">{busyId === alert.id ? <Loader2 size={10} className="animate-spin" /> : <Wrench size={10} />}Prepare task</button> : null}
      </div>
      <div className="mt-2 flex items-start gap-1 text-[8px] leading-3 text-slate-500"><ShieldCheck size={9} className="mt-0.5 shrink-0" />Monitoring never bypasses approval for consequential actions.</div>
    </article>)}
    {message ? <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[8px] text-slate-300">{message}</div> : null}
  </section>;
}
