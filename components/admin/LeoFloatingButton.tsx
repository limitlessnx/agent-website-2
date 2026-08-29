"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, Loader2, MessageSquareText, PhoneCall, Send, ShieldCheck, X } from "@/components/admin/ServerIcons";
import LeoRealtimeVoice from "@/components/leo/LeoRealtimeVoice";
import LeoActionCenter from "@/components/leo/LeoActionCenter";
import LeoProactiveAlerts from "@/components/leo/LeoProactiveAlerts";
import { useLeoConversation } from "@/components/leo/LeoConversationContext";

function buildPageContext(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  return { pathname, section: parts[1] || "dashboard", resourceType: parts[2] || parts[1] || "dashboard", resourceId: parts[3] || undefined, localTime: new Date().toString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
}

export default function LeoFloatingButton() {
  const pathname = usePathname();
  const context = useMemo(() => buildPageContext(pathname), [pathname]);
  const [open, setOpen] = useState(false);
  const [voice, setVoice] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  const messageRef = useRef<HTMLTextAreaElement | null>(null);
  const { sessionId, messages, busy, error, operationState, sendMessage, setSessionId, appendTranscript } = useLeoConversation();
  const handleAlertCount = useCallback((count: number, critical: number) => { setAlertCount(count); setCriticalCount(critical); }, []);

  function closeLeo() { setOpen(false); setVoice(false); }
  useEffect(() => { if (!open) return; const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closeLeo(); }; window.addEventListener("keydown", handleKeyDown); return () => window.removeEventListener("keydown", handleKeyDown); }, [open]);
  useEffect(() => { if (open && !voice) messageRef.current?.focus(); }, [open, voice]);

  const statusLabel = operationState === "investigating" ? "Investigating" : operationState === "executing" ? "Executing" : operationState === "approval_required" ? "Approval required" : operationState === "completed" ? "Executed" : operationState === "error" ? "Needs attention" : alertCount ? `${alertCount} signal${alertCount === 1 ? "" : "s"}` : "Ready";
  const statusDot = operationState === "error" || criticalCount ? "bg-rose-400" : operationState === "investigating" || operationState === "executing" ? "bg-amber-300" : operationState === "approval_required" || alertCount ? "bg-orange-300" : "bg-emerald-400";

  async function submitMessage(form: HTMLFormElement) {
    const message = String(new FormData(form).get("message") || "").trim();
    if (!message || busy) return;
    form.reset();
    await sendMessage(message, context);
  }

  return <>
    <button type="button" aria-label="Open Agent Leo" aria-expanded={open} aria-controls="leo-assistant-panel" onClick={() => setOpen(true)} className="leo-launcher fixed bottom-6 right-6 z-[120] flex h-12 min-w-12 items-center justify-center gap-2 rounded-full border border-violet-300/30 bg-slate-950 px-4 text-white shadow-2xl transition hover:-translate-y-0.5 hover:border-violet-200/60 focus:outline-none focus:ring-2 focus:ring-violet-300/50 max-md:bottom-[82px] max-md:right-3"><span className="relative"><Bot size={17} />{alertCount ? <span className={`absolute -right-2.5 -top-2.5 grid min-h-4 min-w-4 place-items-center rounded-full px-1 text-[8px] font-black text-white ${criticalCount ? "bg-rose-500" : "bg-amber-500"}`}>{Math.min(alertCount, 9)}{alertCount > 9 ? "+" : ""}</span> : null}</span><span className="text-xs font-semibold">Leo</span></button>
    <aside id="leo-assistant-panel" aria-label="Agent Leo" aria-modal="false" className={`fixed bottom-20 right-6 z-[119] flex h-[min(680px,calc(100vh-110px))] w-[min(440px,calc(100vw-28px))] flex-col overflow-hidden rounded-2xl border border-violet-300/20 bg-slate-950 text-white shadow-2xl transition-all duration-200 max-md:bottom-[146px] max-md:right-3 max-md:h-[min(460px,calc(100dvh-170px))] max-md:w-[calc(100vw-24px)] ${open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}>
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl border border-violet-300/20 bg-violet-500/10"><Bot size={18} /></span><div><strong className="block text-sm">Agent Leo</strong><span className="flex items-center gap-1.5 text-[10px] text-slate-400"><span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />{statusLabel} · {context.section}</span></div></div><button type="button" onClick={closeLeo} aria-label="Close Leo" title="Close Leo" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-300/50"><X size={17} /></button></header>
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-2"><span className="flex min-w-0 items-center gap-2 truncate text-[10px] text-slate-400">Current page: <strong className="truncate text-slate-200">{context.resourceType}</strong></span><div className="flex items-center rounded-lg border border-white/10 bg-white/[0.03] p-0.5" role="group" aria-label="Leo conversation mode"><button type="button" className={`flex min-h-7 items-center gap-1.5 rounded-md px-2 text-[9px] font-semibold transition ${!voice ? "bg-violet-500/20 text-violet-100" : "text-slate-400 hover:text-white"}`} aria-pressed={!voice} onClick={() => setVoice(false)} title="Message Leo"><MessageSquareText size={13} /><span>Message</span></button><button type="button" className={`flex min-h-7 items-center gap-1.5 rounded-md px-2 text-[9px] font-semibold transition ${voice ? "bg-violet-500/20 text-violet-100" : "text-slate-400 hover:text-white"}`} aria-pressed={voice} onClick={() => setVoice(true)} title="Call Leo"><PhoneCall size={13} /><span>Call</span></button></div></div>
      <LeoProactiveAlerts open={open} sessionId={sessionId} onCount={handleAlertCount} />
      <div className="relative min-h-0 flex-1">
        {open && voice ? <div className="absolute inset-0 flex flex-col"><LeoRealtimeVoice sessionId={sessionId || undefined} pageContext={context} onSessionId={setSessionId} onTranscript={appendTranscript} onCallEnded={() => setVoice(false)} /></div> : null}
        {!voice ? <div className="absolute inset-0 flex flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 text-xs">{!messages.length ? <div className="flex h-full flex-col items-center justify-center text-center text-slate-400"><Bot size={28} className="mb-3 text-violet-300" /><strong className="text-base text-white">What needs attention?</strong><p className="mt-2 max-w-xs leading-5">Leo understands this page, monitors operational evidence, and can investigate Fluxknight in context.</p></div> : messages.map((item, index) => <div key={`${item.role}-${index}`} className={`mb-3 ${item.role === "user" ? "text-right" : "text-left"}`}><span className="mb-1 block text-[9px] font-bold tracking-wider text-slate-500">{item.role === "user" ? "YOU" : "LEO"}{item.source === "voice" ? " · VOICE" : ""}</span><div className="inline-block max-w-[90%] whitespace-pre-wrap rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 leading-5">{item.content}</div></div>)}{busy ? <div className="flex items-center gap-2 rounded-lg border border-amber-300/10 bg-amber-300/[0.04] p-2 text-[10px] text-amber-100"><Loader2 size={13} className="animate-spin" />{operationState === "executing" ? "Leo is executing the approved action..." : "Leo is investigating the current state..."}</div> : null}{error ? <div className="mt-3 rounded-lg border border-rose-300/20 bg-rose-500/10 p-2 text-[10px] text-rose-200" role="alert">{error}</div> : null}</div>
          <LeoActionCenter compact />
          <div className="mx-3 mb-2 rounded-lg border border-white/5 bg-white/[0.025] px-3 py-2 text-[9px] text-slate-400"><strong className="text-slate-200">Operational mode:</strong> detect → evaluate → prioritize → alert → recommend → approval → act → verify.</div>
          <form className="border-t border-white/10 bg-slate-950 p-3" onSubmit={(event) => { event.preventDefault(); void submitMessage(event.currentTarget); }}><div className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2"><textarea ref={messageRef} name="message" rows={1} required placeholder="Ask Leo to investigate…" aria-label="Message Leo" className="min-h-8 flex-1 resize-none bg-transparent text-xs text-white outline-none placeholder:text-slate-600" /><button type="submit" disabled={busy} aria-label="Send message" title="Send message" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-600 text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-violet-300/50"><Send size={15} /></button></div><div className="mt-2 flex items-center gap-1 text-[8px] text-slate-600"><ShieldCheck size={10} />Sensitive actions remain approval-gated.</div></form>
        </div> : null}
      </div>
    </aside>
  </>;
}
