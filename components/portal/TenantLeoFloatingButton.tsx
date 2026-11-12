"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, Loader2, Mic, Send, X } from "@/components/admin/ServerIcons";
import LeoActionCenter from "@/components/leo/LeoActionCenter";
import { useLeoConversation } from "@/components/leo/LeoConversationContext";
import LeoRealtimeVoice from "@/components/leo/LeoRealtimeVoice";

export default function TenantLeoFloatingButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [voice, setVoice] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const { sessionId, messages, busy, error, toolCalls, sendMessage, setSessionId, appendTranscript } = useLeoConversation();
  const [, section, resource] = pathname.split("/");
  const pageContext = { pathname, section: section || "overview", resourceType: resource || section || "portal" };

  useEffect(() => {
    if (open && !voice) input.current?.focus({ preventScroll: true });
  }, [open, voice]);

  useEffect(() => {
    const panel = log.current;
    if (open && panel) panel.scrollTop = panel.scrollHeight;
  }, [open, messages, toolCalls, busy]);

  function close() {
    setVoice(false);
    setOpen(false);
    launcher.current?.focus();
  }

  return <>
    <button ref={launcher} type="button" className="leo-launcher fixed bottom-6 right-6 z-[120] flex h-12 items-center gap-2 rounded-full border border-violet-300/30 bg-slate-950 px-4 text-sm font-semibold text-white shadow-2xl" aria-expanded={open} aria-controls={open ? "tenant-leo-chat" : undefined} onClick={() => open ? close() : setOpen(true)}><Bot size={18}/>Super Leo</button>
    {open && <aside id="tenant-leo-chat" aria-label="Tenant Super Leo" onKeyDown={event => { if (event.key === "Escape") close(); }} className="fixed inset-x-3 bottom-20 z-[121] flex h-[min(640px,calc(100dvh-100px))] min-h-0 flex-col overflow-hidden rounded-2xl border border-violet-300/25 bg-slate-950 text-white shadow-2xl sm:left-auto sm:right-6 sm:w-[420px]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        <div><strong className="block text-base">Super Leo</strong><small className="text-slate-400">Workspace support</small></div>
        <div className="flex gap-1">
          <button type="button" onClick={() => setVoice(!voice)} aria-pressed={voice} className="grid h-11 min-w-11 place-items-center rounded-lg px-2 text-sm hover:bg-white/10" aria-label={voice ? "Return to messages" : "Open voice controls"}>{voice ? "Chat" : <Mic size={18}/>}</button>
          <button type="button" onClick={close} aria-label="Close Super Leo" className="grid h-11 w-11 place-items-center rounded-lg hover:bg-white/10"><X size={18}/></button>
        </div>
      </header>
      <div ref={log} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {voice && <LeoRealtimeVoice tenantSurface sessionId={sessionId} pageContext={pageContext} onSessionId={setSessionId} onTranscript={appendTranscript} onCallEnded={() => setVoice(false)}/>}
        <div role="log" aria-label="Leo conversation" className="grid gap-3">
          {!messages.length && !voice && <p className="text-sm leading-6 text-slate-300">Ask Leo to check your workspace, investigate an issue, or help with a dashboard task.</p>}
          {messages.map((item, index) => <div key={index} className={item.role === "user" ? "text-right" : "text-left"}>
            <div className={`inline-block max-w-[92%] whitespace-pre-wrap rounded-xl px-3 py-2.5 text-sm leading-6 [overflow-wrap:anywhere] ${item.role === "user" ? "bg-violet-950" : "bg-white/5"}`}>{item.content}</div>
          </div>)}
        </div>
        {busy && <p role="status" className="my-3 flex items-center gap-2 text-sm text-slate-300"><Loader2 size={16}/>Leo is working…</p>}
        {error && <p role="alert" className="my-3 text-sm text-rose-300">{error}</p>}
        <LeoActionCenter/>
      </div>
      {!voice && <form className="flex shrink-0 items-end gap-2 border-t border-white/10 p-3" onSubmit={event => {
        event.preventDefault();
        const form = event.currentTarget;
        const message = String(new FormData(form).get("message") || "").trim();
        if (!message || busy) return;
        form.reset();
        void sendMessage(message, pageContext);
      }}>
        <textarea ref={input} name="message" rows={1} required aria-label="Message to Super Leo" placeholder="Message Super Leo" className="min-h-11 min-w-0 flex-1 resize-none rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-base text-white"/>
        <button type="submit" disabled={busy} aria-label="Send message" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-violet-600 disabled:opacity-50"><Send size={17}/></button>
      </form>}
    </aside>}
  </>;
}
