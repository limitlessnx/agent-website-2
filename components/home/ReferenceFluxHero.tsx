"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Infinity as InfinityIcon,
  ChevronDown,
  ArrowRight,
  PlayCircle,
  Sparkles,
  Home,
  MessageSquareText,
  Users,
  Workflow,
  BarChart3,
  Settings,
  CalendarDays,
  TrendingUp,
} from "lucide-react";

const metricCards = [
  { label: "Active conversations", value: "1,248", change: "12.5%", color: "#4ade80", path: "M0,15 Q10,5 20,10 T40,12 T60,5 T80,15 T100,2" },
  { label: "Qualified leads", value: "386", change: "8.2%", color: "#60a5fa", path: "M0,18 Q15,10 25,15 T50,8 T75,12 T100,4" },
  { label: "Appointments booked", value: "74", change: "16.3%", color: "#fb923c", path: "M0,10 Q20,15 30,5 T60,10 T80,5 T100,12" },
  { label: "Follow-ups sent", value: "912", change: "7.1%", color: "#c084fc", path: "M0,12 Q15,8 30,14 T65,6 T85,10 T100,3" },
];

const navItems = ["Product", "Features", "Integrations", "Pricing"];

export default function ReferenceFluxHero() {
  return (
    <section className="relative overflow-hidden bg-[#03000A] text-neutral-50 selection:bg-purple-500/30">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[100vh] overflow-hidden">
        <div className="absolute right-[-12rem] top-[3rem] h-[34rem] w-[34rem] rounded-full border border-orange-300/70 shadow-[0_0_35px_rgba(251,146,60,.4),0_0_120px_rgba(168,85,247,.22)] [transform:rotateX(62deg)_rotateY(-12deg)]" />
        <div className="absolute right-[-15rem] top-[-1rem] h-[40rem] w-[40rem] rounded-full border-[18px] border-purple-500/10 blur-md" />
        <svg className="absolute bottom-[-8rem] right-[-3rem] h-[36rem] w-[72rem] opacity-80" viewBox="0 0 1200 600" fill="none" aria-hidden="true">
          {[0,1,2,3,4,5,6,7,8,9,10,11].map((i) => (
            <motion.path
              key={i}
              d={`M${360+i*8} 620 C ${420+i*5} 470, ${600+i*4} ${390-i*8}, ${760+i*9} ${300-i*4} C ${900+i*5} ${220+i*3}, 1060 ${160+i*4}, 1230 ${130+i*2}`}
              stroke={i % 4 === 0 ? "#fb923c" : i % 3 === 0 ? "#ec4899" : "#a855f7"}
              strokeWidth={i % 4 === 0 ? 2.2 : 1.15}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: [0.18, 0.9, 0.35] }}
              transition={{ duration: 3.5 + i * 0.18, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: i * 0.08 }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_20%,rgba(168,85,247,.12),transparent_26%),radial-gradient(circle_at_85%_26%,rgba(249,115,22,.08),transparent_22%)]" />
      </div>

      <nav className="relative z-50 mx-auto flex max-w-7xl items-center justify-between px-6 pt-6">
        <Link href="/" className="flex items-center gap-2">
          <InfinityIcon className="h-8 w-8 text-purple-500" strokeWidth={1.8} />
          <span className="text-xl font-medium tracking-tight">Fluxknight</span>
        </Link>

        <div className="hidden items-center gap-8 text-sm font-medium text-neutral-300 md:flex">
          {navItems.map((item) => (
            <Link key={item} href={item === "Pricing" ? "/pricing" : `#${item.toLowerCase()}`} className="transition-colors hover:text-white">
              {item}
            </Link>
          ))}
          <div className="flex cursor-pointer items-center gap-1 transition-colors hover:text-white">Resources <ChevronDown className="h-4 w-4" /></div>
        </div>

        <div className="flex items-center gap-6">
          <Link href="/login" className="hidden text-sm font-medium text-neutral-300 transition-colors hover:text-white md:block">Log in</Link>
          <Link href="/evaluation" className="flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-orange-500 px-5 py-2 text-sm font-medium text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all hover:shadow-[0_0_25px_rgba(168,85,247,0.5)]">
            Evaluate My Business <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </nav>

      <div className="relative z-10 mx-auto grid min-h-[85vh] max-w-7xl grid-cols-1 items-center gap-12 px-6 pb-32 pt-24 lg:grid-cols-12 lg:gap-8 lg:pb-40 lg:pt-32">
        <div className="z-20 flex flex-col gap-6 lg:col-span-5 lg:gap-8">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7 }} className="flex items-start">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-purple-400" strokeWidth={1.5} />
              <span className="text-xs font-medium uppercase tracking-wide text-purple-300">AI-Powered Sales & Customer Operations</span>
            </div>
          </motion.div>

          <h1 className="text-5xl font-medium leading-[1.1] tracking-tight md:text-6xl lg:text-7xl">
            {["Turn more leads", "into customers", "with AI."].map((line, index) => (
              <div key={line} className="overflow-hidden pb-1">
                <motion.div
                  initial={{ y: "110%" }}
                  animate={{ y: "0%" }}
                  transition={{ duration: 1.05, delay: .12 + index * .14, ease: [0.22, 1, 0.36, 1] }}
                  className={index === 2 ? "block bg-gradient-to-r from-orange-300 via-pink-400 to-purple-400 bg-clip-text text-transparent" : "block"}
                >
                  {line}
                </motion.div>
              </div>
            ))}
          </h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: .72 }} className="max-w-md text-lg font-normal leading-relaxed text-neutral-400">
            Fluxknight replies to leads, qualifies them, follows up, sends reminders, books appointments and keeps your team updated.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: .84 }} className="flex flex-col items-center gap-4 pt-2 sm:flex-row">
            <Link href="/pricing" className="group flex w-full items-center justify-center gap-2 rounded-full bg-neutral-100 px-6 py-3 text-sm font-medium text-neutral-950 transition-all duration-300 hover:scale-[1.02] hover:bg-white hover:shadow-[0_4px_20px_rgba(255,255,255,0.15)] sm:w-auto">
              See Pricing <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="#services" className="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white backdrop-blur-md transition-all duration-300 hover:bg-white/10 sm:w-auto">
              Watch how it works <PlayCircle className="h-5 w-5 text-neutral-300" />
            </Link>
          </motion.div>
        </div>

        <div className="relative z-20 w-full lg:col-span-7" style={{ perspective: "1200px" }}>
          <div className="pointer-events-none absolute inset-0 -translate-y-10 scale-90 rounded-full bg-purple-500/20 blur-[100px] mix-blend-screen" />
          <motion.div
            initial={{ opacity: 0, rotateY: -20, rotateX: 10, y: 40 }}
            animate={{ opacity: 1, rotateY: -12, rotateX: 4, y: [0, -12, 0] }}
            transition={{ opacity: { duration: 1.4, delay: .5 }, rotateY: { duration: 1.6, delay: .5 }, rotateX: { duration: 1.6, delay: .5 }, y: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: 2.1 } }}
            className="relative ml-auto aspect-[16/10] w-full max-w-[800px] rounded-2xl"
            style={{ transformStyle: "preserve-3d", boxShadow: "-20px 30px 60px rgba(0,0,0,.8), inset 0 0 0 1px rgba(255,255,255,.1)" }}
          >
            <div className="absolute inset-0 overflow-hidden rounded-2xl bg-gradient-to-br from-white/20 via-white/5 to-transparent p-[1px]">
              <div className="absolute inset-0 rounded-2xl bg-[#0A0A12]/80 backdrop-blur-xl" />
              <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-400/30 to-transparent" />

              <div className="relative flex h-full flex-row overflow-hidden rounded-2xl text-sm">
                <aside className="hidden w-48 flex-col border-r border-white/5 bg-white/[0.02] pt-6 sm:flex">
                  <div className="mb-8 px-6"><InfinityIcon className="h-6 w-6 text-purple-500" /></div>
                  <div className="flex flex-col gap-1 px-3">
                    {[
                      [Home, "Overview", true],
                      [MessageSquareText, "Conversations", false],
                      [Users, "Leads", false],
                      [Workflow, "Automations", false],
                      [BarChart3, "Analytics", false],
                    ].map(([Icon, label, active]) => {
                      const Cmp = Icon as typeof Home;
                      return <div key={String(label)} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium ${active ? "bg-purple-500/20 text-purple-300" : "text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-200"}`}><Cmp className="h-4 w-4" />{String(label)}</div>;
                    })}
                  </div>
                  <div className="mt-auto mb-6 px-6"><div className="flex items-center gap-3 text-neutral-400"><Settings className="h-4 w-4" /><span className="text-xs font-medium">Settings</span></div></div>
                </aside>

                <div className="flex flex-1 flex-col overflow-hidden p-6">
                  <div className="mb-6 flex items-start justify-between">
                    <div><h3 className="text-base font-medium text-neutral-100">Good morning, team 👋</h3><p className="mt-1 text-xs text-neutral-500">Here&apos;s what Fluxknight handled across your customer journey today.</p></div>
                    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300"><CalendarDays className="h-4 w-4" /> This month <ChevronDown className="ml-1 h-3 w-3 text-neutral-500" /></div>
                  </div>

                  <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {metricCards.map((card, i) => (
                      <motion.div key={card.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65, delay: .9 + i * .08 }} className="flex flex-col gap-1 rounded-xl border border-white/5 bg-white/[0.03] p-4">
                        <span className="text-[10px] font-medium text-neutral-400">{card.label}</span>
                        <span className="text-lg font-medium tracking-tight text-white">{card.value}</span>
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-green-400"><TrendingUp className="h-3 w-3" />{card.change}</div>
                        <div className="relative mt-2 h-6 w-full"><svg viewBox="0 0 100 20" className="h-full w-full overflow-visible"><motion.path d={card.path} fill="none" stroke={card.color} strokeWidth="1.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 1.15 + i * .1 }} /></svg></div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="grid flex-1 grid-cols-3 gap-6">
                    <div className="relative col-span-2 flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-4">
                      <div className="mb-4 flex items-center justify-between"><span className="text-xs font-medium text-neutral-200">Customer journey activity</span><div className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[10px] text-neutral-400">This Month <ChevronDown className="h-3 w-3" /></div></div>
                      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between px-4 pb-8 pt-12 opacity-20">{[0,1,2,3].map(i => <div key={i} className="h-px w-full border-b border-white/20" />)}</div>
                      <div className="relative mt-2 ml-6 flex-1">
                        <svg viewBox="0 0 400 150" className="h-full w-full overflow-visible" preserveAspectRatio="none">
                          <motion.path d="M0,120 C40,90 80,130 120,80 C160,30 200,90 240,60 C280,30 320,60 360,20 L400,40" fill="none" stroke="#c084fc" strokeWidth="2.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.5, delay: 1.1 }} />
                          <motion.path d="M0,140 C50,130 90,145 140,110 C190,75 230,120 280,90 C330,60 370,100 400,70" fill="none" stroke="#60a5fa" strokeWidth="2" opacity=".7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.5, delay: 1.25 }} />
                          <motion.path d="M0,150 C60,145 100,155 160,130 C220,105 260,140 320,120 C380,100 390,130 400,110" fill="none" stroke="#fb923c" strokeWidth="1.5" opacity=".5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.5, delay: 1.4 }} />
                        </svg>
                      </div>
                      <div className="mt-2 ml-6 flex justify-between px-2 text-[8px] text-neutral-600"><span>Week 1</span><span>Week 2</span><span>Week 3</span><span>Week 4</span><span>Now</span></div>
                    </div>

                    <div className="col-span-1 flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-4">
                      <span className="mb-4 text-xs font-medium text-neutral-200">Top channels</span>
                      <div className="relative flex flex-1 items-center justify-center">
                        <motion.div initial={{ scale: .5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: .8, delay: 1.4 }} className="relative flex h-24 w-24 items-center justify-center rounded-full" style={{ background: "conic-gradient(from 180deg,#c084fc 0% 48%,#3b82f6 48% 76%,#8b5cf6 76% 92%,#fb923c 92% 100%)" }}>
                          <div className="absolute inset-0 rounded-full border-[16px] border-[#0A0A12]" /><div className="z-10 flex h-16 w-16 items-center justify-center rounded-full bg-[#0A0A12] shadow-inner"><span className="text-xs font-medium text-white">1.2K</span></div>
                        </motion.div>
                      </div>
                      <div className="mt-4 flex flex-col gap-2 text-[9px]">
                        {[["WhatsApp", "48%", "bg-purple-400"],["Website", "28%", "bg-blue-500"],["Voice", "16%", "bg-indigo-500"]].map(([name, value, dot]) => <div key={name} className="flex items-center justify-between"><div className="flex items-center gap-1.5 text-neutral-400"><div className={`h-1.5 w-1.5 rounded-full ${dot}`} />{name}</div><span className="text-white">{value}</span></div>)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
