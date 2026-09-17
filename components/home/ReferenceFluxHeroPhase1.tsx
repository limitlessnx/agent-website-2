"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BarChart3, CalendarDays, CheckCircle2, Clock3, Home, MessageSquareText, PlayCircle, Settings, Sparkles, Users, Workflow } from "lucide-react";

const metrics = [
  { label: "ACTIVE CONVERSATIONS", value: "1,248", change: "+12.5%", color: "#C084FC", path: "M0,16 C18,15 23,5 40,10 S64,17 78,8 S92,5 100,3" },
  { label: "QUALIFIED LEADS", value: "386", change: "+8.2%", color: "#FB923C", path: "M0,18 C18,11 26,17 42,11 S63,5 77,10 S92,8 100,4" },
  { label: "APPOINTMENTS", value: "74", change: "+16.3%", color: "#C084FC", path: "M0,15 C15,18 26,5 40,9 S63,14 78,7 S91,4 100,8" },
  { label: "FOLLOW-UPS", value: "912", change: "+7.1%", color: "#C084FC", path: "M0,16 C17,9 28,15 43,10 S64,4 78,9 S91,8 100,3" },
];

const streams = Array.from({ length: 16 }, (_, i) => i);
const particles = Array.from({ length: 22 }, (_, i) => ({ left: `${(i * 41) % 100}%`, top: `${(i * 67) % 100}%`, delay: (i % 8) * .25, duration: 4.8 + (i % 5) * .7 }));

export default function ReferenceFluxHeroPhase1() {
  const reduceMotion = useReducedMotion();
  return (
    <section className="relative isolate overflow-hidden bg-[#03000A] text-white selection:bg-[#C084FC]/30">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-[20rem] top-[-8rem] h-[48rem] w-[48rem] rounded-full border border-[#C084FC]/20 shadow-[0_0_80px_rgba(192,132,252,.12),0_0_180px_rgba(192,132,252,.10)] sm:-right-[14rem]" />
        <div className="absolute -right-[17rem] top-[-5rem] h-[42rem] w-[42rem] rounded-full border-[14px] border-[#C084FC]/[0.035] blur-md" />
        <svg className="absolute -bottom-16 -right-[35rem] h-[34rem] w-[76rem] opacity-35 sm:-right-[18rem] lg:-right-[4rem] lg:opacity-60" viewBox="0 0 1200 600" fill="none">
          {streams.map((i) => <motion.path key={i} d={`M${330 + i * 7} 625 C ${410 + i * 5} ${500 - i * 4}, ${585 + i * 6} ${420 - i * 6}, ${755 + i * 8} ${320 - (i % 4) * 9} C ${900 + i * 4} ${230 + (i % 3) * 8}, 1060 ${170 + (i % 5) * 5}, 1230 ${130 + (i % 4) * 4}`} stroke={i % 5 === 0 ? "#FB923C" : "#C084FC"} strokeWidth={i % 5 === 0 ? 1.7 : .8} strokeLinecap="round" initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }} animate={reduceMotion ? { opacity: .35 } : { pathLength: 1, opacity: [.08,.58,.14] }} transition={reduceMotion ? undefined : { duration: 5 + i * .18, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: i * .07 }} />)}
        </svg>
        {!reduceMotion && particles.map((p, i) => <motion.span key={i} className="absolute h-[2px] w-[2px] rounded-full bg-[#C084FC]/60 shadow-[0_0_8px_rgba(192,132,252,.5)]" style={{left:p.left,top:p.top}} animate={{opacity:[.08,.65,.08],y:[0,-4,0]}} transition={{duration:p.duration,repeat:Infinity,ease:"easeInOut",delay:p.delay}} />)}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_22%,rgba(192,132,252,.12),transparent_26%),radial-gradient(circle_at_30%_55%,rgba(251,146,60,.05),transparent_30%)]" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-[calc(100svh-72px)] max-w-7xl grid-cols-1 items-center gap-12 px-5 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20 lg:grid-cols-12 lg:gap-8 lg:pb-28 lg:pt-24">
        <div className="z-20 flex flex-col items-start lg:col-span-5">
          <motion.div initial={reduceMotion ? false : {opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:.55}} className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#C084FC]/25 bg-[#C084FC]/[0.08] px-3 py-1.5 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-[#FB923C]" strokeWidth={1.5}/><span className="font-mono text-[10px] font-semibold uppercase tracking-[.14em] text-[#C084FC] sm:text-xs">AI-powered business operations</span>
          </motion.div>
          <h1 className="max-w-[11ch] text-[2.8rem] font-medium leading-[1.01] tracking-[-.045em] sm:text-[4rem] lg:text-[4rem]">{["Grow your organization", "without growing", "the workload."].map((line,index)=><div key={line} className="overflow-hidden pb-1"><motion.span className={index===2?"block text-[#C084FC]":"block"} initial={reduceMotion?false:{y:"110%"}} animate={{y:0}} transition={{duration:.9,delay:reduceMotion?0:.08+index*.12,ease:[.22,1,.36,1]}}>{line}</motion.span></div>)}</h1>
          <motion.p initial={reduceMotion?false:{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.65,delay:reduceMotion?0:.52}} className="mt-6 max-w-[35rem] text-[15px] leading-[1.7] text-[#A1A1AA] sm:text-base">Fluxknight builds AI systems that handle customer conversations and the work that follows, from enquiry and support to follow-up, scheduling, CRM updates, and human handoff.</motion.p>
          <motion.div initial={reduceMotion?false:{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.65,delay:reduceMotion?0:.62}} className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/evaluation" className="group flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#C084FC] px-6 py-3 text-sm font-semibold text-[#03000A] shadow-[0_12px_36px_rgba(192,132,252,.18)] transition hover:bg-[#FB923C]">Evaluate My Business <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1"/></Link>
            <Link href="#services" className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#27272A] bg-[#18181B]/60 px-6 py-3 text-sm font-medium text-white backdrop-blur-md transition hover:border-[#C084FC]/50 hover:bg-[#18181B]"><PlayCircle className="h-4 w-4 text-[#FB923C]"/> See how it works</Link>
          </motion.div>
        </div>

        <motion.div initial={reduceMotion?false:{opacity:0,y:28,scale:.98}} animate={{opacity:1,y:0,scale:1}} transition={{duration:.9,delay:reduceMotion?0:.28,ease:[.22,1,.36,1]}} className="relative z-20 lg:col-span-7">
          <div className="pointer-events-none absolute inset-8 rounded-full bg-[#C084FC]/15 blur-[90px]" />
          <div className="relative overflow-hidden rounded-2xl border border-[#27272A] bg-[#18181B]/95 shadow-[0_32px_90px_rgba(0,0,0,.55),0_0_50px_rgba(192,132,252,.08)] backdrop-blur-xl">
            <div className="flex min-h-[500px]">
              <aside className="hidden w-44 shrink-0 flex-col border-r border-[#27272A]/80 bg-[#0A0A14] px-3 py-5 md:flex">
                <div className="mb-7 px-3"><span className="font-mono text-[10px] font-semibold uppercase tracking-[.16em] text-[#C084FC]">Fluxknight OS</span></div>
                <div className="space-y-1">{[[Home,"Overview",true],[MessageSquareText,"Conversations",false],[Users,"Leads",false],[Workflow,"Automations",false],[BarChart3,"Analytics",false]].map(([Icon,label,active])=>{const C=Icon as typeof Home;return <div key={String(label)} className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[11px] ${active?"border border-[#C084FC]/15 bg-[#C084FC]/10 text-[#C084FC]":"text-[#71717A]"}`}><C className="h-3.5 w-3.5"/>{String(label)}</div>})}</div>
                <div className="mt-auto flex items-center gap-2.5 px-3 text-[11px] text-[#71717A]"><Settings className="h-3.5 w-3.5"/>Settings</div>
              </aside>
              <div className="min-w-0 flex-1 p-4 sm:p-5 lg:p-6">
                <div className="mb-5 flex items-start justify-between gap-3"><div><p className="font-mono text-[9px] font-semibold uppercase tracking-[.14em] text-[#C084FC]">LIVE OPERATIONS</p><h3 className="mt-1.5 text-sm font-medium text-white sm:text-base">Good morning, team 👋</h3><p className="mt-1 hidden text-[11px] text-[#71717A] sm:block">Here&apos;s what Fluxknight handled today.</p></div><span className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#27272A] bg-[#18181B]/70 px-2.5 py-2 font-mono text-[9px] text-[#A1A1AA]"><CalendarDays className="h-3.5 w-3.5"/>This month</span></div>
                <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">{metrics.map(card=><div key={card.label} className="rounded-xl border border-[#27272A] bg-[#18181B]/45 p-3"><span className="font-mono text-[7px] font-semibold tracking-[.08em] text-[#71717A] sm:text-[8px]">{card.label}</span><div className="mt-1 flex items-end justify-between gap-1"><strong className="text-lg font-medium tracking-tight text-white">{card.value}</strong><span className="text-[8px] text-emerald-400">{card.change}</span></div><svg viewBox="0 0 100 20" className="mt-2 h-5 w-full"><path d={card.path} fill="none" stroke={card.color} strokeWidth="1.4"/></svg></div>)}</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-5">
                  <div className="rounded-xl border border-[#27272A] bg-[#18181B]/35 p-4 sm:col-span-3"><div className="flex items-center justify-between"><span className="text-[11px] font-medium text-white">Customer journey activity</span><span className="font-mono text-[8px] text-[#71717A]">REAL TIME</span></div><div className="relative mt-5 h-32"><div className="absolute inset-0 flex flex-col justify-between opacity-20">{[0,1,2,3].map(i=><span key={i} className="border-t border-[#27272A]"/>)}</div><svg viewBox="0 0 400 130" preserveAspectRatio="none" className="relative h-full w-full"><path d="M0 108 C45 86 72 118 116 77 C156 38 196 88 238 57 C279 27 321 62 359 25 C375 12 389 19 400 16" fill="none" stroke="#C084FC" strokeWidth="2.2"/><path d="M0 120 C52 114 92 126 140 97 C188 68 231 107 280 80 C328 52 368 83 400 61" fill="none" stroke="#FB923C" strokeWidth="1.4" opacity=".6"/></svg></div></div>
                  <div className="rounded-xl border border-[#27272A] bg-[#18181B]/35 p-4 sm:col-span-2"><div className="flex items-center justify-between"><span className="text-[11px] font-medium text-white">Live workflow</span><span className="flex items-center gap-1 font-mono text-[8px] text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/>RUNNING</span></div><div className="mt-4 space-y-2"><div className="flex items-center gap-2 rounded-lg border border-[#C084FC]/10 bg-[#C084FC]/[.06] p-2.5"><MessageSquareText className="h-4 w-4 shrink-0 text-[#C084FC]"/><div className="min-w-0 flex-1"><p className="truncate text-[9px] text-white">WhatsApp enquiry qualified</p><span className="text-[8px] text-[#71717A]">Maia · 1m ago</span></div><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400"/></div><div className="flex items-center gap-2 rounded-lg border border-[#27272A] bg-[#18181B]/60 p-2.5"><Clock3 className="h-4 w-4 shrink-0 text-[#71717A]"/><div className="min-w-0 flex-1"><p className="truncate text-[9px] text-white">Follow-up scheduled</p><span className="text-[8px] text-[#71717A]">Automatic</span></div><ArrowRight className="h-3.5 w-3.5 text-[#71717A]"/></div></div></div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
