"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BarChart3, CalendarDays, Home, MessageSquareText, PlayCircle, Settings, Sparkles, Users, Workflow } from "lucide-react";

const metrics = [
  { label: "ACTIVE CONVERSATIONS", value: "1,248", change: "12.5%", color: "#4ade80", path: "M0,15 Q10,5 20,10 T40,12 T60,5 T80,15 T100,2" },
  { label: "QUALIFIED LEADS", value: "386", change: "8.2%", color: "#60a5fa", path: "M0,18 Q15,10 25,15 T50,8 T75,12 T100,4" },
  { label: "APPOINTMENTS", value: "74", change: "16.3%", color: "#fb923c", path: "M0,10 Q20,15 30,5 T60,10 T80,5 T100,12" },
  { label: "FOLLOW-UPS", value: "912", change: "7.1%", color: "#c084fc", path: "M0,12 Q15,8 30,14 T65,6 T85,10 T100,3" },
];

const streamColors = ["#ff0088", "#aa00ff", "#ff5500", "#4400ff"];
const streams = Array.from({ length: 12 }, (_, i) => i);
const particles = Array.from({ length: 16 }, (_, i) => ({ left: `${(i * 37) % 100}%`, top: `${(i * 61) % 100}%`, delay: (i % 7) * .18, duration: 6 + (i % 4) * .7 }));

export default function ReferenceFluxHeroPhase1() {
  const reduceMotion = useReducedMotion();
  return (
    <section className="relative isolate overflow-hidden bg-[#03000A] text-neutral-50 selection:bg-purple-500/30">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <motion.div className="absolute -right-[22rem] top-[-10rem] h-[48rem] w-[48rem] rounded-full border border-[#ffaa55]/80 shadow-[0_0_18px_rgba(255,170,85,.55),0_0_55px_rgba(255,85,0,.30),0_0_120px_rgba(170,0,255,.18)] sm:-right-[15rem] lg:-right-[10rem]" animate={reduceMotion ? undefined : { rotate: 360 }} transition={reduceMotion ? undefined : { duration: 90, repeat: Infinity, ease: "linear" }} />
        <motion.div className="absolute -right-[22rem] top-[-10rem] h-[48rem] w-[48rem] rounded-full border-[10px] border-[#ff5500]/10 blur-sm md:blur-md sm:-right-[15rem] lg:-right-[10rem]" animate={reduceMotion ? undefined : { scale: [1,1.02,1] }} transition={reduceMotion ? undefined : { duration: 4, repeat: Infinity, ease: "easeInOut" }} />
        <div className="absolute -right-[22rem] top-[-10rem] h-[48rem] w-[48rem] rounded-full border-[30px] border-[#aa00ff]/[.045] blur-2xl sm:-right-[15rem] lg:-right-[10rem]" />
        <svg className="absolute -bottom-24 -right-[38rem] h-[42rem] w-[88rem] opacity-65 sm:-right-[24rem] lg:-right-[6rem]" viewBox="0 0 1200 600" fill="none">
          {streams.map((i) => <motion.path key={i} className={i >= 6 ? "hidden md:block" : undefined} d={`M${270 + i * 5} 630 C ${350 + i * 3} ${510 - i * 2}, ${560 + i * 5} ${430 - i * 4}, ${745 + i * 7} ${315 - (i % 5) * 8} C ${900 + i * 4} ${225 + (i % 4) * 9}, 1060 ${165 + (i % 6) * 6}, 1240 ${125 + (i % 5) * 5}`} stroke={streamColors[i % streamColors.length]} strokeWidth={i % 6 === 0 ? 1.8 : .75} strokeLinecap="round" initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }} animate={reduceMotion ? { opacity: .4 } : { pathLength: 1, opacity: .46 }} transition={reduceMotion ? undefined : { duration: 1.1 + i * .04, ease: "easeOut", delay: i * .025 }} />)}
        </svg>
        {!reduceMotion && particles.map((p, i) => <motion.span key={i} className={`absolute h-[2px] w-[2px] rounded-full bg-[#aa88ff]/60 ${i >= 8 ? "hidden md:block" : ""}`} style={{left:p.left,top:p.top}} animate={{opacity:[.08,.65,.08],y:[0,-5,0]}} transition={{duration:p.duration,repeat:Infinity,ease:"easeInOut",delay:p.delay}} />)}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_20%,rgba(170,0,255,.10),transparent_28%),radial-gradient(circle_at_65%_75%,rgba(255,0,136,.06),transparent_28%),radial-gradient(circle_at_86%_38%,rgba(255,85,0,.08),transparent_22%)]" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-[85vh] max-w-7xl grid-cols-1 items-center gap-12 px-6 pb-32 pt-24 lg:grid-cols-12 lg:gap-8 lg:pb-40 lg:pt-32">
        <div className="z-20 flex flex-col gap-6 lg:col-span-5 lg:gap-8">
          <motion.div initial={reduceMotion ? false : {opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:.35,ease:"easeOut"}} className="flex items-start">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 backdrop-blur-md"><Sparkles className="h-4 w-4 text-purple-400" strokeWidth={1.5}/><span className="text-xs font-medium uppercase tracking-wide text-purple-300">AI-powered business operations</span></div>
          </motion.div>

          <h1 className="text-5xl font-medium leading-[1.1] tracking-tight md:text-6xl lg:text-7xl">
            {["Grow your organization", "without growing", "the workload."].map((line,index)=><div key={line} className="overflow-hidden pb-1"><motion.span className={index===2?"block bg-gradient-to-r from-orange-300 via-pink-400 to-purple-400 bg-clip-text text-transparent":"block"} initial={reduceMotion?false:{y:"110%"}} animate={{y:0}} transition={{duration:.62,delay:reduceMotion?0:.04+index*.07,ease:[.22,1,.36,1]}}>{line}</motion.span></div>)}
          </h1>

          <motion.p initial={reduceMotion?false:{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{duration:.45,delay:reduceMotion?0:.14,ease:"easeOut"}} className="max-w-md text-lg font-normal leading-relaxed text-neutral-400">Fluxknight builds AI systems that handle customer conversations and the work that follows, from enquiry and support to follow-up, scheduling, CRM updates, and human handoff.</motion.p>

          <motion.div initial={reduceMotion?false:{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{duration:.45,delay:reduceMotion?0:.2,ease:"easeOut"}} className="flex flex-col items-center gap-4 pt-2 sm:flex-row">
            <Link href="/evaluation" className="group flex w-full items-center justify-center gap-2 rounded-full bg-neutral-100 px-6 py-3 text-sm font-medium text-neutral-950 transition-all duration-300 hover:scale-[1.02] hover:bg-white hover:shadow-[0_4px_20px_rgba(255,255,255,.15)] sm:w-auto">Evaluate My Business <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1"/></Link>
            <Link href="#services" className="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white backdrop-blur-md transition-all duration-300 hover:bg-white/10 sm:w-auto">See how it works <PlayCircle className="h-[18px] w-[18px] text-neutral-300"/></Link>
          </motion.div>
        </div>

        <motion.div initial={reduceMotion?false:{opacity:0,y:40,rotateY:-20,rotateX:10}} animate={{opacity:1,y:0,rotateY:-12,rotateX:4}} transition={{duration:.72,delay:reduceMotion?0:.12,ease:[.22,1,.36,1]}} className="relative z-20 w-full lg:col-span-7" style={{perspective:"1200px",transformStyle:"preserve-3d"}}>
          <div className="pointer-events-none absolute inset-0 -translate-y-10 scale-90 rounded-full bg-purple-500/20 blur-[70px] md:blur-[100px] mix-blend-screen" />
          <div className="relative ml-auto aspect-[16/10] w-full max-w-[800px] rounded-2xl p-px bg-gradient-to-br from-white/20 via-white/5 to-transparent shadow-[-20px_30px_60px_rgba(0,0,0,.8)]">
            <div className="absolute inset-px rounded-2xl bg-[#0A0A12]/80 backdrop-blur-xl" />
            <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-400/30 to-transparent" />
            <div className="relative flex h-full overflow-hidden rounded-2xl text-sm">
              <aside className="hidden w-48 shrink-0 flex-col border-r border-white/5 bg-white/[.02] pt-6 sm:flex">
                <div className="mb-8 px-6"><span className="text-lg font-medium tracking-tight text-purple-500">Fluxknight</span></div>
                <div className="flex flex-col gap-1 px-3">{[[Home,"Overview",true],[BarChart3,"Analytics",false],[MessageSquareText,"Conversations",false],[Users,"Leads",false],[Workflow,"Automations",false]].map(([Icon,label,active])=>{const C=Icon as typeof Home;return <div key={String(label)} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs ${active?"bg-purple-500/20 text-purple-300":"text-neutral-400"}`}><C className="h-4 w-4"/><span className="font-medium">{String(label)}</span></div>})}</div>
                <div className="mt-auto mb-6 flex items-center gap-3 px-6 text-xs text-neutral-400"><Settings className="h-4 w-4"/>Settings</div>
              </aside>

              <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
                <div className="mb-4 flex items-start justify-between sm:mb-6"><div><h3 className="text-sm font-medium text-neutral-100 sm:text-base">Good morning, team 👋</h3><p className="mt-1 hidden text-xs text-neutral-500 sm:block">Here&apos;s what Fluxknight handled today.</p></div><div className="hidden items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300 md:flex"><CalendarDays className="h-4 w-4"/>This month</div></div>
                <div className="mb-4 grid grid-cols-2 gap-2 sm:mb-6 sm:grid-cols-4 sm:gap-4">{metrics.map((card,i)=><motion.div key={card.label} initial={reduceMotion?false:{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{duration:.34,delay:reduceMotion?0:.28+i*.045,ease:"easeOut"}} className="flex flex-col gap-1 rounded-xl border border-white/5 bg-white/[.03] p-2.5 sm:p-4"><span className="text-[8px] font-medium text-neutral-400 sm:text-[10px]">{card.label}</span><span className="text-base font-medium tracking-tight text-white sm:text-lg">{card.value}</span><div className={`mt-1 text-[9px] sm:text-[10px] ${i===2?"text-orange-400":"text-green-400"}`}>↗ {card.change}</div><svg viewBox="0 0 100 20" className="mt-1 h-5 w-full sm:mt-2 sm:h-6"><motion.path d={card.path} fill="none" stroke={card.color} strokeWidth="1.5" initial={reduceMotion?false:{pathLength:0}} animate={{pathLength:1}} transition={{duration:.65,delay:reduceMotion?0:.34+i*.04,ease:"easeOut"}}/></svg></motion.div>)}</div>

                <div className="grid min-h-0 flex-1 grid-cols-3 gap-3 sm:gap-6">
                  <div className="relative col-span-2 flex flex-col rounded-xl border border-white/5 bg-white/[.02] p-3 sm:p-4"><div className="mb-3 flex items-center justify-between sm:mb-4"><span className="text-[10px] font-medium text-neutral-200 sm:text-xs">Customer journey activity</span><span className="rounded border border-white/10 px-2 py-1 text-[8px] text-neutral-400 sm:text-[10px]">This Month</span></div><div className="pointer-events-none absolute inset-x-4 bottom-8 top-12 flex flex-col justify-between opacity-20">{[0,1,2,3].map(i=><span key={i} className="h-px w-full border-b border-white/20"/>)}</div><div className="relative mt-2 flex-1"><svg viewBox="0 0 400 150" className="h-full w-full" preserveAspectRatio="none"><motion.path d="M0,120 C40,90 80,130 120,80 C160,30 200,90 240,60 C280,30 320,60 360,20 L400,40" fill="none" stroke="#c084fc" strokeWidth="2.5" initial={reduceMotion?false:{pathLength:0}} animate={{pathLength:1}} transition={{duration:.85,delay:reduceMotion?0:.38,ease:"easeOut"}}/><motion.path d="M0,140 C50,130 90,145 140,110 C190,75 230,120 280,90 C330,60 370,100 400,70" fill="none" stroke="#60a5fa" strokeWidth="2" opacity=".7" initial={reduceMotion?false:{pathLength:0}} animate={{pathLength:1}} transition={{duration:.85,delay:reduceMotion?0:.43,ease:"easeOut"}}/><motion.path d="M0,150 C60,145 100,155 160,130 C220,105 260,140 320,120 C380,100 390,130 400,110" fill="none" stroke="#fb923c" strokeWidth="1.5" opacity=".5" initial={reduceMotion?false:{pathLength:0}} animate={{pathLength:1}} transition={{duration:.85,delay:reduceMotion?0:.48,ease:"easeOut"}}/></svg></div></div>
                  <div className="col-span-1 flex flex-col rounded-xl border border-white/5 bg-white/[.02] p-3 sm:p-4"><span className="mb-2 text-[10px] font-medium text-neutral-200 sm:mb-4 sm:text-xs">Top Channels</span><div className="flex flex-1 items-center justify-center"><motion.div initial={reduceMotion?false:{scale:.5,opacity:0}} animate={{scale:1,opacity:1}} transition={{duration:.4,delay:reduceMotion?0:.42,ease:"easeOut"}} className="relative flex h-16 w-16 items-center justify-center rounded-full sm:h-24 sm:w-24" style={{background:"conic-gradient(from 180deg,#c084fc 0% 48%,#3b82f6 48% 76%,#8b5cf6 76% 92%,#fb923c 92% 100%)"}}><div className="absolute inset-[11px] rounded-full bg-[#0A0A12] sm:inset-4"/><span className="relative z-10 text-[9px] font-medium text-white sm:text-xs">1.2K</span></motion.div></div><div className="mt-2 hidden flex-col gap-2 text-[9px] sm:flex"><div className="flex justify-between"><span className="text-neutral-400">WhatsApp</span><span>48%</span></div><div className="flex justify-between"><span className="text-neutral-400">Web</span><span>28%</span></div><div className="flex justify-between"><span className="text-neutral-400">Voice</span><span>16%</span></div></div></div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
