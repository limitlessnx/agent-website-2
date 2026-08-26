"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, Loader2, Mic, Send, ShieldCheck, X } from "@/components/admin/ServerIcons";
import LeoRealtimeVoice from "@/components/leo/LeoRealtimeVoice";

type LeoMessage = { role: "user" | "assistant"; content: string };

function buildPageContext(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  return { pathname, section: parts[1] || "dashboard", resourceType: parts[2] || parts[1] || "dashboard", resourceId: parts[3] || undefined, localTime: new Date().toString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
}

export default function LeoFloatingButton() {
  const pathname = usePathname();
  const context = useMemo(() => buildPageContext(pathname), [pathname]);
  const [open, setOpen] = useState(false);
  const [voice, setVoice] = useState(false);
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<LeoMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendMessage(form: HTMLFormElement) {
    const message = String(new FormData(form).get("message") || "").trim();
    if (!message || busy) return;
    form.reset(); setBusy(true); setError("");
    setMessages((current) => [...current, { role: "user", content: message }]);
    try {
      const response = await fetch("/api/leo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, sessionId: conversationId || undefined, pageContext: context, channel: "chat" }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Leo could not respond.");
      setConversationId(result.sessionId || "");
      setMessages((current) => [...current, { role: "assistant", content: result.reply || "Leo returned no response." }]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Leo could not respond."); }
    finally { setBusy(false); }
  }

  return <>
    <button type="button" aria-label="Open Agent Leo" onClick={() => setOpen(true)} className="fixed bottom-6 right-6 z-[120] flex h-12 min-w-12 items-center justify-center gap-2 rounded-full border border-violet-300/30 bg-slate-950 px-4 text-white shadow-2xl transition hover:-translate-y-0.5 hover:border-violet-200/60 focus:outline-none focus:ring-2 focus:ring-violet-300/50} max-md:bottom-[82px] max-md:right-3"><Bot size={17} /><span className="text-xs font-semibold">Leo</span></button>
    <aside aria-label="Agent Leo" className={`fixed bottom-20 right-6 z-[119] flex h-[min(680px,calc(100vh-110px))] w-[min(440px,calc(100vw-28px))] flex-col overflow-hidden rounded-2xl border border-violet-300/20 bg-slate-950 text-white shadow-2xl transition-all duration-200 max-md:bottom-[146px] max-md:right-3 max-md:h-[min(460px,calc(100dvh-170px))] max-md:w-[calc(100vw-24px)] ${open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}>
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl border border-violet-300/20 bg-violet-500/10"><Bot size={18} /></span><div><strong className="block text-sm">Agent Leo</strong><span className="text-[10px] text-slate-400">Fluxknight operator · {context.section}</span></div></div><button type="button" onClick={() => setOpen(false)} aria-label="Minimize Leo" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"><X size={17} /></button></header>
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2 text-[10px] text-slate-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Current page: <strong className="text-slate-200">{context.resourceType}</strong></div>
      <div className="relative min-h-0 flex-1">
        <div className={`absolute inset-0 flex flex-col ${voice ? "opacity-100" : "pointer-events-none opacity-0"}`}><LeoRealtimeVoice sessionId={conversationId || undefined} /></div>
        <div className={`absolute inset-0 flex flex-col ${voice ? "pointer-events-none opacity-0" : "opacity-100"}`}>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 text-xs">{!messages.length ? <div className="flex h-full flex-col items-center justify-center text-center text-slate-400"><Bot size={28} className="mb-3 text-violet-300" /><strong className="text-base text-white">What needs attention?</strong><p className="mt-2 max-w-xs leading-5">Leo understands your current page and can inspect Fluxknight in context.</p></div> : messages.map((item, index) => <div key={`${item.role}-${index}`} className={`mb-3 ${item.role === "user" ? "text-right" : "text-left"}`}><span className="mb-1 block text-[9px] font-bold tracking-wider text-slate-500">{item.role === "user" ? "YOU" : "LEO"}</span><div className="inline-block max-w-[90%] whitespace-pre-wrap rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 leading-5">{item.content}</div></div>)}{busy ? <div className="flex items-center gap-2 text-[10px] text-slate-400"><Loader2 size={13} className="animate-spin" />Leo is inspecting Fluxknight...</div> : null}{error ? <div className="mt-3 rounded-lg border border-rose-300/20 bg-rose-500/10 p-2 text-[10px] text-rose-200">{error}</div> : null}</div>
          <form className="border-t border-white/10 bg-slate-950 p-3" onSubmit={(event) => { event.preventDefault(); void sendMessage(event.currentTarget); }}><div className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2"><textarea name="message" rows={1} required placeholder="Ask Leo about this page..." className="min-h-8 flex-1 resize-none bg-transparent text-xs text-white outline-none placeholder:text-slate-600" /><button type="button" onClick={() => setVoice(true)} aria-label="Start Leo voice call" className="grid h-8 w-8 place-items-center rounded-lg border border-violet-300/20 bg-violet-500/10 text-violet-200"><Mic size={15} /></button><button type="submit" disabled={busy} aria-label="Send" className="grid h-8 w-8 place-items-center rounded-lg bg-violet-600 text-white disabled:opacity-50"><Send size={15} /></button></div><div className="mt-2 flex items-center gap-1 text-[8px] text-slate-600"><ShieldCheck size={10} />Sensitive actions remain approval-gated.</div></form>
        </div>
      </div>
    </aside>
  </>;
}
