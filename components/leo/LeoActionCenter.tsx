"use client";

import { CheckCircle2, Loader2, Play, ShieldCheck, Wrench, X } from "@/components/admin/ServerIcons";
import { useLeoConversation, type LeoToolCall } from "@/components/leo/LeoConversationContext";

function titleFor(tool: LeoToolCall) {
  return tool.toolKey.split(".").slice(-2).join(" ").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function argumentSummary(tool: LeoToolCall) {
  const entries = Object.entries(tool.arguments).filter(([, value]) => value !== undefined && value !== null && String(value).trim()).slice(0, 3);
  return entries.map(([key, value]) => `${key.replaceAll("_", " ")}: ${String(value).slice(0, 80)}`).join(" · ");
}

function outcomeSummary(tool: LeoToolCall) {
  const result = tool.result && typeof tool.result === "object" ? tool.result as Record<string, unknown> : {};
  const nested = result.result && typeof result.result === "object" ? result.result as Record<string, unknown> : result;
  const delivered = Number(nested.delivered || 0);
  const read = Number(nested.read || 0);
  const failed = Number(nested.failed || 0);
  const pending = Number(nested.pendingDelivery ?? nested.pending_delivery ?? 0);
  const accepted = Number(nested.accepted ?? nested.sent ?? 0);
  if (delivered || read || failed || pending || accepted) {
    return `Accepted ${accepted} · Delivered ${delivered} · Read ${read} · Failed ${failed} · Unresolved ${pending}`;
  }
  return "Execution returned successfully and is recorded. External delivery or post-condition verification may still be pending.";
}

export default function LeoActionCenter({ compact = false }: { compact?: boolean }) {
  const { toolCalls, executeTool, dismissTool, operationState } = useLeoConversation();
  const visible = toolCalls.filter((tool) => tool.status !== "dismissed").slice(-3);
  if (!visible.length) return null;

  return <section className={compact ? "mx-3 mb-2 grid gap-2" : "grid gap-3"} aria-label="Leo prepared actions">
    {visible.map((tool) => {
      const pending = tool.status === "proposed";
      const executing = tool.status === "executing";
      const executed = tool.status === "executed";
      const failed = tool.status === "failed";
      const confirmation = tool.approval === "confirm";
      const argumentText = argumentSummary(tool);
      return <article key={tool.toolKey} className={`rounded-xl border p-3 ${executed ? "border-emerald-400/20 bg-emerald-400/[0.04]" : failed ? "border-rose-400/20 bg-rose-400/[0.05]" : confirmation ? "border-amber-300/20 bg-amber-300/[0.04]" : "border-violet-300/15 bg-violet-400/[0.035]"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${executed ? "bg-emerald-400/10 text-emerald-300" : failed ? "bg-rose-400/10 text-rose-300" : confirmation ? "bg-amber-300/10 text-amber-200" : "bg-violet-400/10 text-violet-200"}`}>{executing ? <Loader2 size={14} className="animate-spin" /> : executed ? <CheckCircle2 size={14} /> : confirmation ? <ShieldCheck size={14} /> : <Wrench size={14} />}</span>
            <div className="min-w-0">
              <span className={`text-[9px] font-black tracking-[0.12em] ${executed ? "text-emerald-300" : failed ? "text-rose-300" : confirmation ? "text-amber-200" : "text-violet-200"}`}>{executing ? "EXECUTING" : executed ? "EXECUTED" : failed ? "ACTION FAILED" : confirmation ? "APPROVAL REQUIRED" : "ACTION PREPARED"}</span>
              <strong className="mt-1 block text-[11px] text-slate-100">{titleFor(tool)}</strong>
            </div>
          </div>
          {pending ? <button type="button" onClick={() => dismissTool(tool.toolKey)} aria-label={`Dismiss ${titleFor(tool)}`} className="rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-200"><X size={13} /></button> : null}
        </div>
        <p className="mt-2 text-[10px] leading-4 text-slate-400">{tool.reason}</p>
        {argumentText ? <p className="mt-1.5 truncate text-[9px] text-slate-500">{argumentText}</p> : null}
        {pending ? <div className="mt-3 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[8px] text-slate-500"><ShieldCheck size={10} />{confirmation ? "Nothing changes until you approve." : "Leo will execute this scoped action."}</span>
          <button type="button" disabled={operationState === "executing" || operationState === "investigating"} onClick={() => void executeTool(tool)} className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-[9px] font-black transition disabled:opacity-50 ${confirmation ? "bg-amber-300 text-slate-950 hover:bg-amber-200" : "bg-violet-600 text-white hover:bg-violet-500"}`}><Play size={11} />{confirmation ? "Approve & execute" : "Execute"}</button>
        </div> : null}
        {executed ? <div className="mt-2 flex items-center gap-1.5 text-[9px] text-emerald-300"><CheckCircle2 size={11} />{outcomeSummary(tool)}</div> : null}
        {failed ? <div className="mt-2 text-[9px] text-rose-300">Leo stopped this action because execution did not complete successfully.</div> : null}
      </article>;
    })}
  </section>;
}
