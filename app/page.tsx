"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Database,
  Headphones,
  MessageSquare,
  Mic,
  Network,
  ShieldCheck,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";
import ElevenLabsConsultant from "@/components/ElevenLabsConsultant";

const capabilities = [
  { icon: Bot, title: "AI Sales", text: "Qualifies prospects, handles objections, and advances deals around the clock." },
  { icon: Headphones, title: "AI Support", text: "Resolves routine questions and hands complex issues to the correct person." },
  { icon: Mic, title: "Voice Agents", text: "Answers and places calls, captures intent, and books appointments." },
  { icon: MessageSquare, title: "Omnichannel", text: "Runs coordinated conversations across web, WhatsApp, Telegram, email, and voice." },
  { icon: Workflow, title: "Automation", text: "Connects n8n, Trigger.dev, Supabase, and your existing business tools." },
  { icon: Database, title: "Business Memory", text: "Stores leads, conversations, tasks, catalog data, and decisions in one system." },
];

const operatingLayers = [
  ["01", "Understand", "Map your sales, support, and operating process before automating anything."],
  ["02", "Deploy", "Launch focused AI employees with clear permissions, workflows, and human handoff."],
  ["03", "Optimize", "Measure conversations, conversion, failures, and opportunities for expansion."],
];

const systems = [
  { title: "Real Estate OS", detail: "Lead qualification, property matching, inspections, nurture, and agent handoff.", status: "Live architecture" },
  { title: "Sales Engine", detail: "Lead sourcing, outbound sequences, reply scoring, CRM updates, and closer alerts.", status: "Deployable" },
  { title: "Customer Care", detail: "Shared inbox, AI support, ticket routing, voice assistance, and escalation.", status: "Deployable" },
  { title: "Operations Agent", detail: "Internal requests, reminders, reporting, document workflows, and approvals.", status: "Custom build" },
];

function WolfMark() {
  return (
    <div className="wolf-stage" aria-label="Fluxknight cyber wolf emblem">
      <div className="wolf-orbit orbit-one" />
      <div className="wolf-orbit orbit-two" />
      <motion.svg
        className="wolf-mark"
        viewBox="0 0 520 520"
        initial={{ opacity: 0, scale: 0.86, rotate: -4 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      >
        <defs>
          <linearGradient id="wolfMetal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#dff7ff" />
            <stop offset="0.24" stopColor="#6bdcff" />
            <stop offset="0.55" stopColor="#0c6fa9" />
            <stop offset="1" stopColor="#03101d" />
          </linearGradient>
          <linearGradient id="wolfDark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#102738" />
            <stop offset="1" stopColor="#02070d" />
          </linearGradient>
          <filter id="wolfGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path d="M88 104 208 54 260 136 312 54 432 104 394 264 338 392 260 458 182 392 126 264Z" fill="url(#wolfDark)" stroke="#1a668d" strokeWidth="4" />
        <path d="M88 104 192 132 126 264Z" fill="url(#wolfMetal)" opacity="0.9" />
        <path d="M432 104 328 132 394 264Z" fill="url(#wolfMetal)" opacity="0.9" />
        <path d="M208 54 260 136 182 174 126 264 192 132Z" fill="#0b1d2b" stroke="#2bbde8" strokeWidth="3" />
        <path d="M312 54 260 136 338 174 394 264 328 132Z" fill="#0b1d2b" stroke="#2bbde8" strokeWidth="3" />
        <path d="M182 174 260 136 338 174 318 330 260 382 202 330Z" fill="url(#wolfMetal)" />
        <path d="M182 174 216 260 260 240 260 136Z" fill="#102b3c" opacity="0.95" />
        <path d="M338 174 304 260 260 240 260 136Z" fill="#071521" opacity="0.95" />
        <path d="M202 330 260 382 318 330 298 396 260 430 222 396Z" fill="#06131d" stroke="#2bbde8" strokeWidth="3" />
        <path d="M148 246 218 228 246 250 206 278 154 270Z" fill="#08111a" stroke="#6ee7ff" strokeWidth="3" />
        <path d="M372 246 302 228 274 250 314 278 366 270Z" fill="#08111a" stroke="#6ee7ff" strokeWidth="3" />
        <path d="M171 252 218 242 231 251 205 263 176 261Z" fill="#9cf1ff" filter="url(#wolfGlow)" />
        <path d="M349 252 302 242 289 251 315 263 344 261Z" fill="#9cf1ff" filter="url(#wolfGlow)" />
        <path d="M238 304 260 282 282 304 260 324Z" fill="#021019" stroke="#84edff" strokeWidth="3" />
        <path d="M260 136V240M216 260l-34 70M304 260l34 70M260 324v58" stroke="#9beeff" strokeWidth="3" opacity="0.7" />
      </motion.svg>
      <div className="wolf-platform" />
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="hero-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="home-v2">
      <ElevenLabsConsultant />

      <section className="hero-v2">
        <div className="hero-grid" />
        <div className="hero-glow" />
        <div className="hero-word" aria-hidden="true">FLUXKNIGHT</div>

        <div className="hero-copy">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="eyebrow">
            <span className="pulse-dot" /> AI BUSINESS OPERATING SYSTEM
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, delay: 0.08 }}>
            Build an AI workforce that <span>hunts bottlenecks.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.18 }}>
            Fluxknight gives growing businesses AI sales, support, voice, lead generation, and workflow agents inside one controlled operating system.
          </motion.p>
          <motion.div className="hero-actions" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.28 }}>
            <Link className="primary-cta" href="/account/signup">Create Account <ArrowRight size={18} /></Link>
            <Link className="secondary-cta" href="/evaluation">Explore Your AI System</Link>
          </motion.div>
        </div>

        <WolfMark />

        <motion.div className="floating-card card-agents" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.65 }}>
          <div className="card-icon"><Bot size={18} /></div>
          <span>Active agents</span>
          <strong>04</strong>
          <small>sales · care · voice · operations</small>
        </motion.div>

        <motion.div className="floating-card card-network" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.75 }}>
          <div className="card-icon"><Network size={18} /></div>
          <span>System status</span>
          <strong className="online"><i /> Connected</strong>
          <small>Supabase · n8n · channels</small>
        </motion.div>

        <div className="hero-bottom">
          <Metric value="24/7" label="Always-on agents" />
          <Metric value="01" label="Shared operating system" />
          <Metric value="∞" label="Configurable workflows" />
        </div>
      </section>

      <section className="manifesto-section">
        <div className="manifesto-word" aria-hidden="true">AUTOMATION</div>
        <div className="section-wrap manifesto-grid">
          <div>
            <p className="section-kicker">A different kind of AI agency</p>
            <h2>Not a chatbot.<br />A coordinated business system.</h2>
          </div>
          <div className="manifesto-copy">
            <p>Most automation projects become a pile of disconnected bots. Fluxknight treats agents, workflows, data, permissions, and human teams as one operating structure.</p>
            <div className="trust-row"><ShieldCheck size={20} /><span>Tenant-isolated data and controlled access</span></div>
            <div className="trust-row"><CheckCircle2 size={20} /><span>Human handoff when confidence or authority runs out</span></div>
            <div className="trust-row"><Zap size={20} /><span>Existing n8n workflows integrated instead of discarded</span></div>
          </div>
        </div>
      </section>

      <section className="capabilities-section">
        <div className="section-wrap">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Fluxknight capabilities</p>
              <h2>One intelligence layer.<br />Multiple AI employees.</h2>
            </div>
            <p>Every module is independent enough to deploy quickly, but structured to collaborate through shared data and clear workflow contracts.</p>
          </div>
          <div className="capability-grid">
            {capabilities.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.article key={item.title} className="capability-card" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.06 }}>
                  <div className="capability-number">0{index + 1}</div>
                  <Icon size={24} />
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="os-showcase">
        <div className="section-wrap os-grid">
          <div className="os-visual">
            <div className="os-light" />
            <div className="os-core">
              <Sparkles size={34} />
              <strong>FLUX CORE</strong>
              <span>agent orchestration</span>
            </div>
            <div className="node node-one"><MessageSquare size={18} /> Channels</div>
            <div className="node node-two"><Database size={18} /> Memory</div>
            <div className="node node-three"><Workflow size={18} /> Workflows</div>
            <div className="node node-four"><ShieldCheck size={18} /> Control</div>
          </div>
          <div className="os-copy">
            <p className="section-kicker">The operating core</p>
            <h2>Your business systems stop working alone.</h2>
            <p>Fluxknight connects conversations, agents, CRM records, catalogs, workflows, and human actions through one tenant-aware platform.</p>
            <Link href="/services">See the architecture <ArrowRight size={17} /></Link>
          </div>
        </div>
      </section>

      <section className="roadmap-section">
        <div className="section-wrap">
          <div className="roadmap-heading">
            <p className="section-kicker">Deployment roadmap</p>
            <h2>A controlled path from audit to live AI workforce.</h2>
          </div>
          <div className="roadmap-grid">
            {operatingLayers.map(([number, title, text], index) => (
              <article className="roadmap-item" key={number}>
                <div className="roadmap-circle"><span>{number}</span></div>
                <div className="roadmap-pill"><i /> {title}</div>
                <p>{text}</p>
                {index < operatingLayers.length - 1 ? <div className="roadmap-line" /> : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="systems-section">
        <div className="section-wrap">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Systems we build</p>
              <h2>Industry-ready foundations.<br />Configured for your business.</h2>
            </div>
            <Link className="text-link" href="/industries">View industries <ArrowRight size={16} /></Link>
          </div>
          <div className="systems-grid">
            {systems.map((system, index) => (
              <article className="system-card" key={system.title}>
                <div className="system-index">0{index + 1}</div>
                <div>
                  <span>{system.status}</span>
                  <h3>{system.title}</h3>
                  <p>{system.detail}</p>
                </div>
                <ArrowRight size={20} />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta-v2">
        <div className="final-glow" />
        <div className="section-wrap final-inner">
          <p className="section-kicker">Enter the system</p>
          <h2>Build the business that keeps moving when you log off.</h2>
          <p>Create your Fluxknight workspace or begin with a strategy evaluation.</p>
          <div className="hero-actions centered-actions">
            <Link className="primary-cta" href="/account/signup">Create Account <ArrowRight size={18} /></Link>
            <Link className="secondary-cta" href="/account/login">Login</Link>
          </div>
        </div>
      </section>

      <style jsx global>{`
        :root { --fk-blue:#27c9ff; --fk-blue-2:#0878bc; --fk-ink:#02060c; --fk-panel:#08121d; --fk-line:rgba(125,210,255,.18); --fk-muted:#7d95aa; }
        .home-v2 { background:#02060c; color:#f6fbff; overflow:hidden; }
        .section-wrap { width:min(1180px, calc(100% - 40px)); margin:0 auto; position:relative; z-index:2; }
        .hero-v2 { min-height:940px; position:relative; display:grid; place-items:center; overflow:hidden; border-bottom:1px solid var(--fk-line); background:radial-gradient(circle at 50% 42%, rgba(19,144,211,.26), transparent 30%), linear-gradient(180deg,#02060c 0%,#03101b 58%,#02060c 100%); }
        .hero-grid { position:absolute; inset:0; opacity:.55; background-image:linear-gradient(rgba(51,159,211,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(51,159,211,.08) 1px,transparent 1px); background-size:86px 86px; mask-image:linear-gradient(to bottom,black,transparent 92%); }
        .hero-glow { position:absolute; width:760px; height:760px; border-radius:50%; background:radial-gradient(circle,rgba(34,184,255,.2),rgba(3,51,79,.08) 42%,transparent 70%); filter:blur(10px); top:160px; left:50%; transform:translateX(-50%); }
        .hero-word { position:absolute; top:180px; left:50%; transform:translateX(-50%); font-size:clamp(5rem,13vw,12rem); font-weight:900; letter-spacing:.04em; color:rgba(214,244,255,.05); white-space:nowrap; }
        .hero-copy { position:absolute; left:max(26px,calc((100vw - 1180px)/2)); top:180px; width:min(520px,44vw); z-index:4; }
        .eyebrow,.section-kicker { color:#5bdcff; letter-spacing:.19em; text-transform:uppercase; font-size:.72rem; font-weight:800; }
        .pulse-dot { width:7px;height:7px;border-radius:50%;background:#64e6ff;box-shadow:0 0 18px #35d5ff;display:inline-block;margin-right:8px; }
        .hero-copy h1 { font-size:clamp(3rem,5.6vw,6.1rem); line-height:.94; letter-spacing:-.055em; margin:28px 0 24px; max-width:720px; }
        .hero-copy h1 span { color:transparent; -webkit-text-stroke:1px #61dfff; text-shadow:0 0 36px rgba(47,201,255,.18); }
        .hero-copy>p { color:#91a9ba; font-size:1.04rem; line-height:1.8; max-width:560px; }
        .hero-actions { display:flex; gap:12px; margin-top:34px; flex-wrap:wrap; }
        .primary-cta,.secondary-cta { min-height:52px; display:inline-flex; align-items:center; justify-content:center; gap:10px; padding:0 24px; border-radius:999px; text-decoration:none; font-weight:800; font-size:.9rem; }
        .primary-cta { color:#001019; background:linear-gradient(135deg,#8bedff,#16b8ef); box-shadow:0 0 38px rgba(39,201,255,.22); }
        .secondary-cta { color:#dcefff; border:1px solid rgba(121,214,255,.28); background:rgba(7,18,29,.66); backdrop-filter:blur(14px); }
        .wolf-stage { position:absolute; width:min(560px,48vw); height:min(620px,65vw); left:58%; top:170px; display:grid; place-items:center; z-index:3; }
        .wolf-mark { width:88%; position:relative; z-index:2; filter:drop-shadow(0 0 34px rgba(42,195,255,.18)); }
        .wolf-orbit { position:absolute; border:1px solid rgba(78,205,255,.18); border-radius:50%; }
        .orbit-one { width:92%;height:92%;animation:spinSlow 28s linear infinite; }
        .orbit-two { width:72%;height:72%;border-style:dashed;animation:spinSlow 19s linear reverse infinite; }
        .wolf-platform { position:absolute; bottom:28px; width:72%; height:62px; border-radius:50%; background:radial-gradient(ellipse,rgba(65,207,255,.38),rgba(5,59,88,.1) 55%,transparent 75%); filter:blur(10px); }
        @keyframes spinSlow { to { transform:rotate(360deg); } }
        .floating-card { position:absolute; z-index:5; width:220px; padding:18px; border:1px solid rgba(113,212,255,.23); border-radius:20px; background:linear-gradient(145deg,rgba(18,37,52,.82),rgba(5,15,24,.66)); backdrop-filter:blur(20px); box-shadow:inset 0 1px rgba(255,255,255,.07),0 18px 50px rgba(0,0,0,.28); }
        .floating-card span,.floating-card small { display:block;color:#7f99ad; }
        .floating-card strong { display:block;font-size:1.55rem;margin:8px 0; }
        .floating-card small { font-size:.7rem;line-height:1.5; }
        .card-icon { width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:rgba(35,196,255,.12);color:#6ee7ff;margin-bottom:13px; }
        .card-agents { left:calc(50% - 40px); top:640px; }
        .card-network { right:max(24px,calc((100vw - 1180px)/2)); top:300px; }
        .online { font-size:1rem!important;color:#d9f7ff;display:flex!important;align-items:center;gap:8px; }
        .online i { width:8px;height:8px;border-radius:50%;background:#62ffbd;box-shadow:0 0 14px #62ffbd; }
        .hero-bottom { position:absolute; bottom:42px; left:50%; transform:translateX(-50%); width:min(1060px,calc(100% - 48px)); display:grid; grid-template-columns:repeat(3,1fr); border-top:1px solid var(--fk-line); padding-top:24px; z-index:4; }
        .hero-metric { text-align:center; border-right:1px solid var(--fk-line); }
        .hero-metric:last-child { border-right:0; }
        .hero-metric strong { display:block;color:#4edbff;font-size:2rem;letter-spacing:-.04em; }
        .hero-metric span { color:#6f879b;font-size:.78rem; }
        .manifesto-section { min-height:690px; position:relative; display:grid; align-items:center; border-bottom:1px solid var(--fk-line); background:radial-gradient(circle at 50% 100%,rgba(24,145,205,.18),transparent 34%),#02060c; }
        .manifesto-word { position:absolute; bottom:54px; left:50%; transform:translateX(-50%); font-size:clamp(5rem,16vw,14rem); font-weight:900; color:rgba(52,190,255,.06); white-space:nowrap; }
        .manifesto-grid { display:grid;grid-template-columns:1.05fr .95fr;gap:90px;align-items:center; }
        .manifesto-grid h2,.section-heading-row h2,.os-copy h2,.roadmap-heading h2,.final-inner h2 { font-size:clamp(2.5rem,5vw,5.2rem);line-height:1;letter-spacing:-.05em;margin:18px 0; }
        .manifesto-copy>p,.section-heading-row>p,.os-copy>p,.final-inner>p { color:#8198ab;line-height:1.85; }
        .trust-row { display:flex;align-items:center;gap:12px;padding:16px 0;border-bottom:1px solid rgba(125,210,255,.12);color:#cfe5f2; }
        .trust-row svg { color:#50d8ff; }
        .capabilities-section,.systems-section { padding:120px 0;background:#03080e; }
        .section-heading-row { display:grid;grid-template-columns:1.15fr .85fr;gap:80px;align-items:end;margin-bottom:60px; }
        .section-heading-row>p { max-width:500px; }
        .capability-grid { display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--fk-line);border-left:1px solid var(--fk-line); }
        .capability-card { min-height:300px;padding:34px;border-right:1px solid var(--fk-line);border-bottom:1px solid var(--fk-line);background:linear-gradient(145deg,rgba(12,28,42,.58),rgba(4,10,16,.62));position:relative; }
        .capability-card svg { color:#61ddff;margin-top:52px; }
        .capability-card h3 { font-size:1.35rem;margin:20px 0 12px; }
        .capability-card p { color:#7890a4;line-height:1.7;font-size:.9rem; }
        .capability-number { position:absolute;right:24px;top:20px;color:rgba(113,217,255,.22);font-size:2.7rem;font-weight:800; }
        .os-showcase { padding:130px 0;border-block:1px solid var(--fk-line);background:radial-gradient(circle at 35% 50%,rgba(20,147,213,.2),transparent 28%),#02060c; }
        .os-grid { display:grid;grid-template-columns:1.15fr .85fr;gap:90px;align-items:center; }
        .os-visual { min-height:560px;position:relative;display:grid;place-items:center;border:1px solid rgba(107,210,255,.16);background:linear-gradient(145deg,rgba(12,32,47,.7),rgba(2,8,14,.55));overflow:hidden; }
        .os-light { position:absolute;width:430px;height:430px;border-radius:50%;background:radial-gradient(circle,rgba(43,190,255,.24),transparent 68%); }
        .os-core { width:190px;height:190px;border-radius:50%;border:1px solid rgba(123,222,255,.35);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:rgba(4,16,25,.82);box-shadow:0 0 70px rgba(34,183,248,.16);z-index:2; }
        .os-core svg { color:#7ceaff; }
        .os-core strong { letter-spacing:.14em; }
        .os-core span { color:#708da2;font-size:.68rem; }
        .node { position:absolute;padding:12px 16px;border:1px solid rgba(115,212,255,.22);border-radius:999px;background:rgba(7,21,31,.8);display:flex;align-items:center;gap:8px;color:#b9d8e8;font-size:.78rem; }
        .node svg { color:#54d8ff; }
        .node-one { top:90px;left:70px; }.node-two{top:110px;right:58px}.node-three{bottom:90px;left:48px}.node-four{bottom:105px;right:68px}
        .os-copy a,.text-link { color:#65ddff;text-decoration:none;display:inline-flex;align-items:center;gap:8px;margin-top:20px;font-weight:700; }
        .roadmap-section { padding:130px 0;background:linear-gradient(180deg,#03111d,#04243a 55%,#02060c); }
        .roadmap-heading { text-align:center;max-width:800px;margin:0 auto 70px; }
        .roadmap-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:34px; }
        .roadmap-item { position:relative;text-align:center;padding:30px 20px; }
        .roadmap-circle { width:250px;height:250px;border-radius:50%;border:1px dashed rgba(112,211,255,.25);margin:0 auto -92px;display:grid;place-items:start center;padding-top:38px;color:#9bcce1; }
        .roadmap-pill { min-height:48px;border-radius:999px;border:1px solid rgba(124,219,255,.2);background:linear-gradient(90deg,rgba(29,93,131,.62),rgba(75,157,202,.4));display:flex;align-items:center;justify-content:center;gap:10px;position:relative;z-index:2;box-shadow:inset 0 1px rgba(255,255,255,.08); }
        .roadmap-pill i { width:8px;height:8px;border-radius:50%;background:white;box-shadow:0 0 10px white; }
        .roadmap-item p { color:#7894a7;font-size:.85rem;line-height:1.7;margin:24px auto 0;max-width:260px; }
        .roadmap-line { position:absolute;top:167px;right:-34px;width:68px;height:1px;background:rgba(93,202,255,.23); }
        .systems-grid { display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--fk-line); }
        .system-card { display:grid;grid-template-columns:70px 1fr auto;gap:24px;align-items:center;min-height:210px;padding:30px;border-right:1px solid var(--fk-line);border-bottom:1px solid var(--fk-line);background:linear-gradient(145deg,rgba(8,22,33,.65),rgba(2,8,13,.45)); }
        .system-card:nth-child(even){border-right:0}.system-index{font-size:2.7rem;color:rgba(88,210,255,.2);font-weight:800}.system-card span{color:#4fd7ff;font-size:.67rem;text-transform:uppercase;letter-spacing:.14em}.system-card h3{font-size:1.35rem;margin:10px 0}.system-card p{color:#748b9e;line-height:1.65;font-size:.86rem}.system-card>svg{color:#4bd4ff}
        .final-cta-v2 { padding:150px 0;position:relative;text-align:center;background:#02060c;border-top:1px solid var(--fk-line); }
        .final-glow { position:absolute;width:700px;height:500px;left:50%;top:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(35,184,249,.16),transparent 66%); }
        .final-inner { max-width:900px; }.final-inner h2{max-width:850px;margin:20px auto}.final-inner>p{max-width:560px;margin:0 auto}.centered-actions{justify-content:center}
        @media (max-width:980px){
          .hero-v2{min-height:1120px;display:block}.hero-copy{position:relative;left:auto;top:auto;width:min(720px,calc(100% - 40px));margin:0 auto;padding-top:135px;text-align:center}.hero-copy>p{margin-inline:auto}.hero-actions{justify-content:center}.wolf-stage{left:50%;transform:translateX(-50%);top:510px;width:min(520px,88vw);height:520px}.card-agents{left:28px;top:760px}.card-network{right:28px;top:610px}.hero-word{top:235px}.manifesto-grid,.section-heading-row,.os-grid{grid-template-columns:1fr;gap:42px}.capability-grid{grid-template-columns:repeat(2,1fr)}.roadmap-grid{grid-template-columns:1fr}.roadmap-line{display:none}.systems-grid{grid-template-columns:1fr}.system-card,.system-card:nth-child(even){border-right:0}}
        @media (max-width:640px){
          .section-wrap{width:min(100% - 28px,1180px)}.hero-v2{min-height:1080px}.hero-copy{width:calc(100% - 28px);padding-top:110px}.hero-copy h1{font-size:3.15rem}.hero-word{top:300px;font-size:4.3rem}.wolf-stage{top:510px;height:430px}.floating-card{width:170px;padding:14px}.card-agents{left:14px;top:780px}.card-network{right:14px;top:625px}.hero-bottom{bottom:28px;width:calc(100% - 28px)}.hero-metric strong{font-size:1.35rem}.hero-metric span{font-size:.62rem}.manifesto-section{padding:100px 0}.manifesto-grid h2,.section-heading-row h2,.os-copy h2,.roadmap-heading h2,.final-inner h2{font-size:2.6rem}.capabilities-section,.systems-section,.roadmap-section,.os-showcase{padding:90px 0}.capability-grid{grid-template-columns:1fr}.capability-card{min-height:260px}.os-visual{min-height:460px}.node{font-size:.66rem;padding:10px}.node-one{left:16px}.node-two{right:14px}.node-three{left:12px}.node-four{right:14px}.systems-grid{display:block}.system-card{grid-template-columns:50px 1fr;}.system-card>svg{display:none}.primary-cta,.secondary-cta{width:100%}.hero-actions{width:100%}.roadmap-circle{width:220px;height:220px}}
      `}</style>
    </main>
  );
}
