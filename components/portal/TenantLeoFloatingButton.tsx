"use client";

import { useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, Loader2, Send, ShieldCheck, X } from "@/components/admin/ServerIcons";
import { useLeoConversation } from "@/components/leo/LeoConversationContext";

export default function TenantLeoFloatingButton() {
  const pathname = usePathname();
  const [open,setOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement|null>(null);
  const { messages,busy,error,operationState,sendMessage } = useLeoConversation();
  const pageContext = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    return { pathname, section: parts[1] || "overview", resourceType: parts[2] || parts[1] || "portal" };
  },[pathname]);

  async function submit(form:HTMLFormElement) {
    const message=String(new FormData(form).get("message")||"").trim();
    if(!message||busy)return;
    form.reset();
    await sendMessage(message,pageContext);
  }

  return <>
    <button type="button" className="leo-launcher fixed bottom-6 right-6 z-[120] flex h-12 items-center gap-2 rounded-full border border-violet-300/30 bg-slate-950 px-4 text-white shadow-2xl" onClick={()=>setOpen(true)} aria-label="Open Tenant Super Leo"><Bot size={17}/><span className="text-xs font-semibold">Super Leo</span></button>
    <aside className={`fixed bottom-20 right-6 z-[119] flex h-[min(620px,calc(100vh-110px))] w-[min(420px,calc(100vw-28px))] flex-col overflow-hidden rounded-2xl border border-violet-300/20 bg-slate-950 text-white shadow-2xl transition ${open?"opacity-100":"pointer-events-none opacity-0 translate-y-3"}`}>
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div><strong className="block text-sm">Tenant Super Leo</strong><small className="text-slate-400">Workspace diagnostics · {operationState.replaceAll("_"," ")}</small></div><button type="button" onClick={()=>setOpen(false)} aria-label="Close Tenant Super Leo"><X size={17}/></button></header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 text-xs">
        {!messages.length?<div className="flex h-full flex-col items-center justify-center text-center text-slate-400"><Bot size={28}/><strong className="mt-3 text-base text-white">What is going wrong?</strong><p className="mt-2 max-w-xs leading-5">I can inspect this organization, explain dashboard issues, diagnose permitted systems, and escalate critical problems to Fluxknight support.</p></div>:messages.map((item,index)=><div key={index} className={`mb-3 ${item.role==="user"?"text-right":"text-left"}`}><div className="inline-block max-w-[90%] whitespace-pre-wrap rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 leading-5">{item.content}</div></div>)}
        {busy?<div className="flex items-center gap-2 text-amber-100"><Loader2 size={13}/><span>Inspecting your workspace…</span></div>:null}
        {error?<div className="mt-3 rounded-lg border border-rose-300/20 bg-rose-500/10 p-2 text-rose-200">{error}</div>:null}
      </div>
      <div className="mx-3 mb-2 rounded-lg border border-white/5 bg-white/[0.025] px-3 py-2 text-[9px] text-slate-400"><ShieldCheck size={10} className="inline mr-1"/>Leo is locked to this organization and your current permissions.</div>
      <form className="border-t border-white/10 p-3" onSubmit={(e)=>{e.preventDefault();void submit(e.currentTarget)}}><div className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2"><textarea ref={inputRef} name="message" rows={1} required placeholder="Ask Super Leo to investigate…" className="min-h-8 flex-1 resize-none bg-transparent text-xs text-white outline-none"/><button type="submit" disabled={busy} className="grid h-9 w-9 place-items-center rounded-lg bg-violet-600"><Send size={15}/></button></div></form>
    </aside>
  </>;
}
