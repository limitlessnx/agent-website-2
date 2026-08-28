"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, Play, RefreshCw, ShieldCheck } from "@/components/admin/ServerIcons";

type Evidence = { status?: string; summary?: string };
type Recovery = { retrySafe?: boolean; reason?: string };
type TaskStep = {
  id: string;
  index: number;
  title: string;
  toolKey: string;
  status: string;
  error?: string;
  evidence?: Evidence;
  recovery?: Recovery;
};
type OperationalTask = {
  id: string;
  goal: string;
  workspace?: string;
  status: string;
  currentStep: number;
  steps: TaskStep[];
  updatedAt: string;
};

function statusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function stepIcon(step: TaskStep, active: boolean) {
  if (step.status === "completed") return <CheckCircle2 size={13} />;
  if (step.status === "failed") return <AlertTriangle size={13} />;
  if (step.status === "waiting_confirmation" || step.status === "approved") return <ShieldCheck size={13} />;
  if (step.status === "executing") return <Loader2 size={13} className="animate-spin" />;
  return active ? <Play size={12} /> : <Clock3 size={12} />;
}

export default function LeoTaskProgress({ sessionId }: { sessionId?: string }) {
  const [task, setTask] = useState<OperationalTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<"resume" | "recover" | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!sessionId) { setTask(null); return; }
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/leo/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "active", sessionId }),
        cache: "no-store",
      });
      if (response.status === 404) { setTask(null); setError(""); return; }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Leo task progress could not be loaded.");
      setTask(payload.task || null);
      setError("");
    } catch (cause) {
      if (!quiet) setError(cause instanceof Error ? cause.message : "Leo task progress could not be loaded.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
    if (!sessionId) return;
    const timer = window.setInterval(() => { if (!document.hidden) void load(true); }, 5000);
    const refresh = () => { if (!document.hidden) void load(true); };
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [load, sessionId]);

  const completed = useMemo(() => task?.steps.filter((step) => step.status === "completed").length || 0, [task]);
  const total = task?.steps.length || 0;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const current = task?.steps[task.currentStep];
  const retrySafe = task?.status === "blocked" && current?.status === "failed" && current.recovery?.retrySafe === true;
  const canResume = Boolean(task && ["ready", "executing"].includes(task.status) && current?.status !== "executing");

  async function act(action: "resume" | "recover") {
    if (!sessionId || !task || acting) return;
    setActing(action); setError("");
    try {
      const response = await fetch("/api/leo/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, sessionId, taskId: task.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok && !payload.task) throw new Error(payload.error || `Leo could not ${action} this task.`);
      if (payload.task) setTask(payload.task);
      await load(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Leo could not ${action} this task.`);
    } finally {
      setActing(null);
    }
  }

  if (!sessionId || (!task && !loading && !error)) return null;

  return <section className="rounded-2xl border border-violet-300/15 bg-[#0b0b15]/80 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.18)]" aria-label="Super Leo operational task progress" aria-live="polite">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-violet-300"><span className="h-1.5 w-1.5 rounded-full bg-violet-400" /> Operational task</div>
        <h3 className="mt-1.5 text-sm font-semibold text-slate-100">{task?.goal || "Loading current task…"}</h3>
        {task?.workspace ? <p className="mt-1 text-[10px] text-slate-500">Workspace: {task.workspace.replaceAll("_", " ")}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        {task ? <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${task.status === "completed" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : task.status === "blocked" ? "border-rose-400/20 bg-rose-400/10 text-rose-300" : task.status === "waiting_confirmation" ? "border-amber-300/20 bg-amber-300/10 text-amber-200" : "border-violet-300/15 bg-violet-400/[0.08] text-violet-200"}`}>{statusLabel(task.status)}</span> : null}
        <button type="button" onClick={() => void load()} disabled={loading || Boolean(acting)} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40" aria-label="Refresh Leo task progress"><RefreshCw size={12} className={loading ? "animate-spin" : ""} /></button>
      </div>
    </div>

    {task ? <>
      <div className="mt-4 flex items-center justify-between text-[9px] text-slate-500"><span>{completed} of {total} steps completed</span><span>{percent}%</span></div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-violet-500 transition-[width] duration-300" style={{ width: `${percent}%` }} /></div>

      <div className="mt-4 grid gap-2">
        {task.steps.map((step, index) => {
          const active = index === task.currentStep && !["completed", "canceled"].includes(task.status);
          return <div key={step.id} className={`rounded-xl border px-3 py-2.5 ${active ? "border-violet-400/25 bg-violet-400/[0.06]" : "border-white/[0.06] bg-white/[0.015]"}`}>
            <div className="flex items-start gap-2.5">
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md ${step.status === "completed" ? "bg-emerald-400/10 text-emerald-300" : step.status === "failed" ? "bg-rose-400/10 text-rose-300" : step.status === "waiting_confirmation" ? "bg-amber-300/10 text-amber-200" : active ? "bg-violet-400/10 text-violet-200" : "bg-white/[0.04] text-slate-500"}`}>{stepIcon(step, active)}</span>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-[10px] font-semibold text-slate-200">{index + 1}. {step.title}</strong><span className="text-[8px] font-black uppercase tracking-[0.08em] text-slate-500">{statusLabel(step.status)}</span></div><p className="mt-0.5 truncate text-[8px] text-slate-600">{step.toolKey}</p>
                {step.evidence?.summary ? <p className={`mt-1.5 text-[9px] leading-4 ${step.evidence.status === "failed" || step.evidence.status === "partial" ? "text-amber-200/80" : "text-emerald-300/80"}`}>{step.evidence.summary}</p> : null}
                {step.error ? <p className="mt-1.5 text-[9px] leading-4 text-rose-300">{step.error}</p> : null}
              </div>
            </div>
          </div>;
        })}
      </div>

      {task.status === "waiting_confirmation" ? <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2 text-[9px] text-amber-100/80"><ShieldCheck size={12} />Waiting for confirmation of the exact current step through Leo. No action is executed until approval is valid.</div> : null}
      {retrySafe && current?.recovery?.reason ? <div className="mt-3 rounded-xl border border-rose-300/15 bg-rose-300/[0.04] px-3 py-2 text-[9px] leading-4 text-rose-100/80">Recovery available: {current.recovery.reason}</div> : null}

      {(canResume || retrySafe) ? <div className="mt-3 flex flex-wrap justify-end gap-2">
        {canResume ? <button type="button" disabled={Boolean(acting)} onClick={() => void act("resume")} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-violet-600 px-3 text-[9px] font-black text-white transition hover:bg-violet-500 disabled:opacity-50">{acting === "resume" ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}Resume task</button> : null}
        {retrySafe ? <button type="button" disabled={Boolean(acting)} onClick={() => void act("recover")} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-amber-300/20 bg-amber-300/[0.08] px-3 text-[9px] font-black text-amber-100 transition hover:bg-amber-300/[0.12] disabled:opacity-50">{acting === "recover" ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}Recover safe step</button> : null}
      </div> : null}
    </> : null}
    {error ? <p className="mt-3 text-[9px] text-rose-300">{error}</p> : null}
  </section>;
}
