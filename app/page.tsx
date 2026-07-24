"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Database,
  Headphones,
  MessageSquare,
  Mic,
  Network,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";
import ElevenLabsConsultant from "@/components/ElevenLabsConsultant";

const featureCards = [
  { icon: Bot, title: "AI Sales Agents", text: "Qualify leads, answer objections, recommend the next step, and move opportunities into your pipeline.", visual: "nodes" },
  { icon: Headphones, title: "Customer Support", text: "Resolve routine questions instantly and route sensitive or complex requests to the correct human.", visual: "people" },
  { icon: Database, title: "Data Integration", text: "Connect conversations, CRM records, catalogs, documents, and operational data in one controlled layer.", visual: "line" },
  { icon: Mic, title: "Voice Automation", text: "Run natural inbound and outbound calls for qualification, booking, reminders, and follow-up.", visual: "wave" },
  { icon: Workflow, title: "Workflow Intelligence", text: "Coordinate n8n, Trigger.dev, Supabase, and business tools through auditable workflow contracts.", visual: "bars" },
];

function MiniChart() {
  return (
    <div className="mini-chart" aria-hidden="true">
      {[36, 55, 44, 72, 62, 84, 67, 91].map((height, index) => (
        <span key={index} style={{ height: `${height}%` }} className={index === 5 ? "active" : ""} />
      ))}
    </div>
  );
}

function DashboardPreview() {
  return (
    <motion.div className="product-preview" initial={{ opacity: 0, y: 42, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .9, delay: .28, ease: [0.16, 1, 0.3, 1] }}>
      <div className="preview-glow" />
      <div className="preview-shell">
        <aside className="preview-sidebar">
          <div className="preview-logo"><Zap size={14} /></div>
          {["home", "agents", "flows", "data"].map((item, index) => <span key={item} className={index === 0 ? "selected" : ""} />)}
        </aside>
        <div className="preview-main">
          <div className="preview-topbar">
            <div><strong>Fluxknight OS</strong><span>Limitless Realty workspace</span></div>
            <div className="preview-user">NE</div>
          </div>
          <div className="preview-heading">
            <div><span>Workspace</span><h3>AI operations dashboard</h3></div>
            <button>Deploy agent</button>
          </div>
          <div className="preview-metrics">
            <article><span>Active agents</span><strong>04</strong><small>All systems online</small></article>
            <article><span>Qualified leads</span><strong>128</strong><small>+18.4% this month</small></article>
            <article><span>Workflow success</span><strong>96.8%</strong><small>1,842 recent runs</small></article>
          </div>
          <div className="preview-grid">
            <article className="preview-chart-card">
              <div className="card-title"><div><span>Automation activity</span><strong>Workflow executions</strong></div><small>Last 7 days</small></div>
              <MiniChart />
              <div className="chart-labels"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
            </article>
            <article className="preview-agent-card">
              <div className="card-title"><div><span>Agent status</span><strong>Maia</strong></div><i /></div>
              <div className="agent-orb"><Sparkles size={24} /></div>
              <p>Real estate sales assistant</p>
              <div className="agent-stat"><span>Conversations today</span><strong>47</strong></div>
              <div className="agent-stat"><span>Human handoffs</span><strong>06</strong></div>
            </article>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FeatureVisual({ type }: { type: string }) {
  if (type === "nodes") return <div className="visual-nodes"><span /><b><Bot size={23} /></b><span /><span /></div>;
  if (type === "people") return <div className="visual-people"><i>NE</i><b><Headphones size={23} /></b><i>AM</i><i>OS</i></div>;
  if (type === "line") return <div className="visual-line"><svg viewBox="0 0 360 110"><path d="M0 82 C42 72 55 88 89 59 S145 80 177 45 S230 68 263 31 S319 48 360 20" fill="none" stroke="url(#lineGlow)" strokeWidth="3"/><defs><linearGradient id="lineGlow"><stop stopColor="#6332cf"/><stop offset="1" stopColor="#d0a9ff"/></linearGradient></defs></svg></div>;
  if (type === "wave") return <div className="visual-wave"><span /><span /><span /><b><Mic size={25} /></b><span /><span /><span /></div>;
  return <div className="visual-bars">{[42,58,74,52,92,68].map((height,index)=><span key={index} style={{height:`${height}%`}} className={index===4?"active":""}/>)}</div>;
}

export default function HomePage() {
  return (
    <main className="quantix-home">
      <ElevenLabsConsultant />

      <section className="quantix-hero">
        <div className="hero-stars" />
        <div className="violet-arc" />
        <div className="hero-haze" />
        <motion.div className="hero-content" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7 }}>
          <div className="hero-pill"><Sparkles size={13} /> Coordinate your AI workforce</div>
          <h1>Elevate your business using<br /><span>AI-driven automation.</span></h1>
          <p>Deploy intelligent sales, support, voice, and workflow agents through one secure operating system built around your business.</p>
          <div className="hero-buttons">
            <Link className="button-primary" href="/account/signup">Create Account <ArrowRight size={17} /></Link>
            <Link className="button-secondary" href="/evaluation">Book a Demo <ArrowRight size={16} /></Link>
          </div>
        </motion.div>
        <DashboardPreview />
      </section>

      <section className="integration-strip">
        <p>Built to connect with the tools your business already uses</p>
        <div><span>n8n</span><span>Supabase</span><span>ElevenLabs</span><span>WhatsApp</span><span>Trigger.dev</span><span>OpenAI</span></div>
      </section>

      <section className="quantix-features">
        <div className="section-intro">
          <div className="small-label"><Sparkles size={12} /> Platform capabilities</div>
          <h2>Accelerate your operations with<br />one connected AI system.</h2>
          <p>Each agent can work independently, while sharing the same data, permissions, workflow registry, and human escalation rules.</p>
        </div>
        <div className="feature-grid">
          {featureCards.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.article key={feature.title} className={index > 2 ? "feature-card wide" : "feature-card"} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ delay: index * .07 }}>
                <FeatureVisual type={feature.visual} />
                <div className="feature-copy"><Icon size={17} /><h3>{feature.title}</h3><p>{feature.text}</p></div>
              </motion.article>
            );
          })}
        </div>
        <Link className="explore-button" href="/services">Explore all capabilities <ArrowRight size={16} /></Link>
      </section>

      <section className="quantix-platform">
        <div className="platform-copy">
          <div className="small-label"><Network size={12} /> Fluxknight platform</div>
          <h2>One control layer for every AI employee.</h2>
          <p>Manage organizations, branches, agent families, projects, workflows, conversations, permissions, and performance from one coherent backend.</p>
          <div className="platform-points">
            <span><Bot size={17} /> Agent management</span>
            <span><Database size={17} /> Shared business memory</span>
            <span><Workflow size={17} /> Workflow monitoring</span>
            <span><MessageSquare size={17} /> Omnichannel conversations</span>
          </div>
          <Link href="/account/signup">Start building <ArrowRight size={17} /></Link>
        </div>
        <div className="platform-visual">
          <div className="platform-ring ring-one" /><div className="platform-ring ring-two" />
          <div className="platform-core"><Zap size={32} /><strong>FLUX CORE</strong><span>orchestration online</span></div>
          <div className="platform-node node-a"><Bot size={17} /> Agents</div>
          <div className="platform-node node-b"><Database size={17} /> Data</div>
          <div className="platform-node node-c"><Workflow size={17} /> Flows</div>
          <div className="platform-node node-d"><Mic size={17} /> Voice</div>
        </div>
      </section>

      <section className="quantix-final">
        <div className="final-glow" />
        <div className="small-label"><Sparkles size={12} /> Build your AI workforce</div>
        <h2>Your business should keep moving<br />when you are not online.</h2>
        <p>Create your Fluxknight workspace and begin configuring the agents your team actually needs.</p>
        <div className="hero-buttons"><Link className="button-primary" href="/account/signup">Create Account <ArrowRight size={17} /></Link><Link className="button-secondary" href="/account/login">Login</Link></div>
      </section>

      <style jsx>{`
        .quantix-home{overflow:hidden;background:#07040f;color:#faf8ff}.quantix-hero{position:relative;min-height:1040px;padding:150px 24px 90px;text-align:center;isolation:isolate}.hero-stars{position:absolute;inset:0;background-image:radial-gradient(rgba(196,164,255,.18) .7px,transparent .7px);background-size:28px 28px;mask-image:linear-gradient(to bottom,#000,transparent 72%);opacity:.28}.violet-arc{position:absolute;z-index:-1;top:82px;left:50%;width:min(1000px,120vw);height:540px;transform:translateX(-50%);border-top:3px solid rgba(218,190,255,.9);border-radius:50%;filter:drop-shadow(0 0 12px #9d62ff) drop-shadow(0 0 54px rgba(139,92,246,.62));opacity:.88}.violet-arc:after{content:"";position:absolute;inset:-4px 8%;border-top:1px solid rgba(255,255,255,.7);border-radius:50%;filter:blur(7px)}.hero-haze{position:absolute;z-index:-2;top:20px;left:50%;width:1050px;height:620px;transform:translateX(-50%);background:radial-gradient(ellipse,rgba(107,55,224,.38),transparent 67%);filter:blur(12px)}.hero-content{position:relative;z-index:3;max-width:820px;margin:0 auto}.hero-pill,.small-label{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border:1px solid rgba(197,160,255,.2);border-radius:999px;background:rgba(139,92,246,.08);color:#b89be9;font-size:.72rem;font-weight:650}.hero-content h1{margin:22px 0 18px;font-size:clamp(2.45rem,6vw,5.1rem);line-height:1.02;letter-spacing:-.055em;font-weight:540}.hero-content h1 span{color:#fff;text-shadow:0 0 42px rgba(190,153,255,.24)}.hero-content>p{max-width:640px;margin:0 auto;color:#a79db9;font-size:1rem;line-height:1.75}.hero-buttons{display:flex;justify-content:center;gap:12px;margin-top:28px;flex-wrap:wrap}.button-primary,.button-secondary{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:13px 18px;border-radius:11px;text-decoration:none;font-size:.86rem;font-weight:700}.button-primary{color:#fff;border:1px solid rgba(217,191,255,.42);background:linear-gradient(135deg,#a55dff,#6f35df);box-shadow:0 12px 38px rgba(91,45,190,.32),0 0 30px rgba(139,92,246,.18)}.button-secondary{color:#cbc1d9;border:1px solid rgba(193,159,248,.2);background:rgba(11,6,22,.52);backdrop-filter:blur(12px)}.product-preview{position:relative;z-index:5;width:min(1040px,100%);margin:72px auto 0;padding:1px;border-radius:20px;background:linear-gradient(120deg,rgba(226,208,255,.42),rgba(124,70,232,.18),rgba(224,204,255,.32));box-shadow:0 36px 100px rgba(12,2,30,.7),0 0 80px rgba(118,63,224,.18)}.preview-glow{position:absolute;left:8%;right:8%;top:-18px;height:50px;background:#9254ff;filter:blur(38px);opacity:.36}.preview-shell{position:relative;display:grid;grid-template-columns:62px 1fr;min-height:540px;overflow:hidden;border-radius:19px;background:linear-gradient(155deg,#10081e,#090512 62%)}.preview-sidebar{padding:17px 12px;display:flex;flex-direction:column;align-items:center;gap:17px;border-right:1px solid rgba(181,142,245,.1);background:rgba(255,255,255,.015)}.preview-logo{width:32px;height:32px;display:grid;place-items:center;border-radius:9px;background:linear-gradient(145deg,#a862ff,#6e35df)}.preview-sidebar>span{width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,.04)}.preview-sidebar>span.selected{background:rgba(139,92,246,.22);box-shadow:inset 0 0 0 1px rgba(185,145,255,.18)}.preview-main{padding:22px;text-align:left}.preview-topbar,.preview-heading,.card-title,.agent-stat{display:flex;align-items:center;justify-content:space-between}.preview-topbar{padding-bottom:18px;border-bottom:1px solid rgba(180,139,255,.1)}.preview-topbar strong,.preview-topbar span{display:block}.preview-topbar strong{font-size:.9rem}.preview-topbar span{margin-top:3px;color:#746a85;font-size:.68rem}.preview-user{width:34px;height:34px;display:grid;place-items:center;border-radius:50%;background:linear-gradient(145deg,#553093,#231238);font-size:.7rem}.preview-heading{margin:24px 0}.preview-heading span{color:#776b8b;font-size:.68rem}.preview-heading h3{margin:4px 0 0;font-size:1.1rem}.preview-heading button{padding:9px 12px;border:1px solid rgba(192,153,255,.24);border-radius:9px;color:#fff;background:linear-gradient(135deg,#8f50ef,#6430ce);font-size:.7rem}.preview-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.preview-metrics article,.preview-chart-card,.preview-agent-card{border:1px solid rgba(180,139,255,.1);border-radius:13px;background:linear-gradient(145deg,rgba(36,20,63,.64),rgba(14,8,27,.72))}.preview-metrics article{padding:15px}.preview-metrics span,.preview-metrics small{display:block;color:#7e728f;font-size:.66rem}.preview-metrics strong{display:block;margin:9px 0 6px;font-size:1.35rem}.preview-grid{display:grid;grid-template-columns:1.7fr .8fr;gap:12px;margin-top:12px}.preview-chart-card,.preview-agent-card{padding:17px}.card-title span,.card-title strong{display:block}.card-title span{color:#776b88;font-size:.64rem}.card-title strong{margin-top:4px;font-size:.82rem}.card-title small{color:#776b88;font-size:.62rem}.mini-chart{height:210px;display:flex;align-items:flex-end;gap:12px;padding:26px 8px 0}.mini-chart span{flex:1;min-width:12px;border-radius:7px 7px 2px 2px;background:linear-gradient(180deg,rgba(151,91,242,.7),rgba(75,39,135,.18))}.mini-chart span.active{background:linear-gradient(180deg,#c597ff,#7f46e5);box-shadow:0 0 28px rgba(168,105,255,.46)}.chart-labels{display:flex;justify-content:space-between;color:#60566f;font-size:.58rem}.preview-agent-card{text-align:center}.preview-agent-card .card-title{text-align:left}.preview-agent-card .card-title i{width:8px;height:8px;border-radius:50%;background:#8dffbf;box-shadow:0 0 12px #51e38b}.agent-orb{width:78px;height:78px;margin:22px auto 12px;display:grid;place-items:center;border-radius:50%;color:#fff;background:radial-gradient(circle,#b981ff,#6735d6 52%,#25103e 72%);box-shadow:0 0 36px rgba(163,99,255,.38)}.preview-agent-card p{color:#756a87;font-size:.65rem}.agent-stat{padding:9px 0;border-top:1px solid rgba(180,139,255,.08);text-align:left}.agent-stat span{color:#746a84;font-size:.62rem}.agent-stat strong{font-size:.72rem}.integration-strip{padding:35px 24px 90px;text-align:center}.integration-strip p{color:#6f657f;font-size:.72rem}.integration-strip div{max-width:900px;margin:24px auto 0;display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap}.integration-strip span{color:#82778f;font-size:.86rem;font-weight:700;letter-spacing:-.02em}.quantix-features{padding:90px 24px 110px}.section-intro{max-width:760px;margin:0 auto 52px;text-align:center}.section-intro h2,.platform-copy h2,.quantix-final h2{margin:18px 0 14px;font-size:clamp(2rem,4vw,3.4rem);line-height:1.08;letter-spacing:-.048em;font-weight:540}.section-intro p,.platform-copy>p,.quantix-final>p{color:#958aa7;line-height:1.75}.feature-grid{max-width:1120px;margin:auto;display:grid;grid-template-columns:repeat(6,1fr);gap:14px}.feature-card{grid-column:span 2;min-height:330px;overflow:hidden;border:1px solid rgba(180,139,255,.13);border-radius:17px;background:linear-gradient(150deg,rgba(31,17,55,.76),rgba(12,7,22,.84));box-shadow:0 24px 66px rgba(11,2,27,.24)}.feature-card.wide{grid-column:span 3}.feature-copy{padding:19px 20px 22px}.feature-copy>svg{color:#9b68f1}.feature-copy h3{margin:11px 0 8px;font-size:.98rem}.feature-copy p{margin:0;color:#867b96;font-size:.78rem;line-height:1.65}.visual-nodes,.visual-people,.visual-line,.visual-wave,.visual-bars{position:relative;height:200px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 50%,rgba(139,92,246,.19),transparent 58%)}.visual-nodes b,.visual-people b{width:58px;height:58px;display:grid;place-items:center;border-radius:50%;color:#fff;background:linear-gradient(145deg,#ae6aff,#6730d6);box-shadow:0 0 30px rgba(156,90,255,.4)}.visual-nodes span{position:absolute;width:14px;height:14px;border-radius:50%;background:#5d348e;box-shadow:0 0 18px rgba(139,92,246,.5)}.visual-nodes span:first-child{left:18%;top:35%}.visual-nodes span:nth-child(3){right:17%;top:30%}.visual-nodes span:last-child{right:26%;bottom:20%}.visual-people{gap:17px}.visual-people i{width:34px;height:34px;display:grid;place-items:center;border-radius:50%;background:#2c173f;color:#baa8cc;font-size:.58rem;font-style:normal}.visual-line svg{width:100%;height:100%}.visual-wave{gap:7px}.visual-wave span{width:3px;height:48px;border-radius:5px;background:linear-gradient(#4e287e,#b878ff,#4e287e)}.visual-wave span:nth-child(2),.visual-wave span:nth-child(6){height:76px}.visual-wave span:nth-child(3),.visual-wave span:nth-child(5){height:104px}.visual-wave b{width:64px;height:64px;display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle,#b77eff,#6a32d7);box-shadow:0 0 34px rgba(164,94,255,.42)}.visual-bars{align-items:flex-end;gap:14px;padding:35px 60px}.visual-bars span{flex:1;max-width:34px;border-radius:7px 7px 2px 2px;background:linear-gradient(#6e3ab6,#28143d)}.visual-bars span.active{background:linear-gradient(#ce9cff,#7e43df);box-shadow:0 0 24px rgba(174,108,255,.42)}.explore-button{width:max-content;margin:30px auto 0;display:flex;align-items:center;gap:8px;padding:11px 15px;border:1px solid rgba(195,159,248,.2);border-radius:10px;color:#d2c4e3;background:rgba(139,92,246,.08);text-decoration:none;font-size:.76rem}.quantix-platform{max-width:1120px;margin:0 auto 110px;padding:40px 24px;display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:70px}.platform-copy>a{display:inline-flex;align-items:center;gap:8px;margin-top:26px;color:#cfaaff;text-decoration:none;font-size:.86rem}.platform-points{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:24px}.platform-points span{display:flex;align-items:center;gap:8px;color:#9c90ae;font-size:.75rem}.platform-points svg{color:#9b63ee}.platform-visual{position:relative;height:470px;display:grid;place-items:center}.platform-ring{position:absolute;border:1px solid rgba(182,139,255,.14);border-radius:50%}.ring-one{width:360px;height:360px}.ring-two{width:250px;height:250px;box-shadow:0 0 70px rgba(107,53,223,.16)}.platform-core{position:relative;z-index:2;width:145px;height:145px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid rgba(208,178,255,.3);border-radius:34px;color:#fff;background:linear-gradient(145deg,#4f2788,#1c0e31);box-shadow:0 0 50px rgba(139,92,246,.32)}.platform-core strong{margin-top:10px;font-size:.78rem;letter-spacing:.08em}.platform-core span{margin-top:4px;color:#aa97bd;font-size:.58rem}.platform-node{position:absolute;display:flex;align-items:center;gap:8px;padding:10px 13px;border:1px solid rgba(190,150,255,.16);border-radius:11px;background:rgba(23,12,40,.86);color:#aa9ab9;font-size:.7rem}.node-a{left:3%;top:18%}.node-b{right:2%;top:24%}.node-c{left:6%;bottom:18%}.node-d{right:4%;bottom:16%}.quantix-final{position:relative;padding:120px 24px;text-align:center;border-top:1px solid rgba(180,139,255,.1);background:linear-gradient(to bottom,rgba(139,92,246,.04),transparent)}.quantix-final>*{position:relative;z-index:2}.quantix-final>p{max-width:590px;margin:0 auto}.final-glow{position:absolute;z-index:0;left:50%;top:50%;width:750px;height:350px;transform:translate(-50%,-50%);background:radial-gradient(ellipse,rgba(117,60,230,.22),transparent 68%);filter:blur(20px)}
        @media(max-width:800px){.quantix-hero{min-height:auto;padding-top:125px}.violet-arc{top:70px;height:360px}.hero-content h1 br{display:none}.product-preview{margin-top:52px}.preview-shell{grid-template-columns:1fr;min-height:0}.preview-sidebar{display:none}.preview-main{padding:14px}.preview-metrics{grid-template-columns:1fr}.preview-grid{grid-template-columns:1fr}.preview-agent-card{display:none}.mini-chart{height:160px;gap:6px}.feature-grid{grid-template-columns:1fr}.feature-card,.feature-card.wide{grid-column:1}.quantix-platform{grid-template-columns:1fr;gap:20px}.platform-copy{text-align:center}.platform-points{grid-template-columns:1fr}.platform-points span{justify-content:center}.platform-visual{height:390px}.ring-one{width:310px;height:310px}.ring-two{width:220px;height:220px}.integration-strip div{justify-content:center}.quantix-final h2 br{display:none}}
      `}</style>
    </main>
  );
}
