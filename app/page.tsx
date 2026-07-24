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
} from "lucide-react";
import ElevenLabsConsultant from "@/components/ElevenLabsConsultant";

const featureCards = [
  {
    icon: Bot,
    title: "AI Sales Agents",
    text: "Qualify leads, answer objections, recommend the next step, and move opportunities into your pipeline.",
    image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=900&q=85",
  },
  {
    icon: Headphones,
    title: "Customer Support",
    text: "Resolve routine questions instantly and route sensitive or complex requests to the correct human.",
    image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=85",
  },
  {
    icon: Database,
    title: "Data Integration",
    text: "Connect conversations, CRM records, catalogs, documents, and operational data in one controlled layer.",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=85",
  },
  {
    icon: Mic,
    title: "Voice Automation",
    text: "Run natural inbound and outbound calls for qualification, booking, reminders, and follow-up.",
    image: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=900&q=85",
  },
  {
    icon: Workflow,
    title: "Workflow Intelligence",
    text: "Coordinate n8n, Trigger.dev, Supabase, and business tools through auditable workflow contracts.",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=85",
  },
];

export default function HomePage() {
  return (
    <main className="quantix-home">
      <ElevenLabsConsultant />

      <section className="quantix-hero">
        <div className="hero-stars" />
        <div className="violet-arc" />
        <div className="hero-haze" />

        <motion.div
          className="hero-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <div className="hero-pill">
            <Sparkles size={13} /> Coordinate your AI workforce
          </div>
          <h1>
            Elevate your business using <span>AI-driven automation.</span>
          </h1>
          <p>
            Deploy intelligent sales, support, voice, and workflow agents through one secure operating system built around your business.
          </p>
          <div className="hero-buttons">
            <Link className="button-primary" href="/account/signup">
              Create Account <ArrowRight size={17} />
            </Link>
            <Link className="button-secondary" href="/evaluation">
              Book a Demo <ArrowRight size={16} />
            </Link>
          </div>
        </motion.div>

        <motion.div
          className="product-shot"
          initial={{ opacity: 0, y: 42, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <img src="/flux-dashboard.svg" alt="Fluxknight AI operations dashboard" />
        </motion.div>
      </section>

      <section className="integration-strip">
        <p>Built to connect with the tools your business already uses</p>
        <div>
          <span>n8n</span>
          <span>Supabase</span>
          <span>ElevenLabs</span>
          <span>WhatsApp</span>
          <span>Trigger.dev</span>
          <span>OpenAI</span>
        </div>
      </section>

      <section className="quantix-features">
        <div className="section-intro">
          <div className="small-label">
            <Sparkles size={12} /> Platform capabilities
          </div>
          <h2>Accelerate your operations with one connected AI system.</h2>
          <p>
            Each agent can work independently while sharing the same data, permissions, workflow registry, and human escalation rules.
          </p>
        </div>

        <div className="feature-grid">
          {featureCards.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.article
                key={feature.title}
                className={index > 2 ? "feature-card wide" : "feature-card"}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: index * 0.07 }}
              >
                <div className="feature-media">
                  <img src={feature.image} alt="" />
                </div>
                <div className="feature-copy">
                  <Icon size={17} />
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </div>
              </motion.article>
            );
          })}
        </div>

        <Link className="explore-button" href="/services">
          Explore all capabilities <ArrowRight size={16} />
        </Link>
      </section>

      <section className="quantix-platform">
        <div className="platform-copy">
          <div className="small-label">
            <Network size={12} /> Fluxknight platform
          </div>
          <h2>One control layer for every AI employee.</h2>
          <p>
            Manage organizations, branches, agent families, projects, workflows, conversations, permissions, and performance from one coherent backend.
          </p>
          <div className="platform-points">
            <span><Bot size={17} /> Agent management</span>
            <span><Database size={17} /> Shared business memory</span>
            <span><Workflow size={17} /> Workflow monitoring</span>
            <span><MessageSquare size={17} /> Omnichannel conversations</span>
          </div>
          <Link href="/account/signup">
            Start building <ArrowRight size={17} />
          </Link>
        </div>
        <div className="platform-image" aria-label="AI network visualization" />
      </section>

      <section className="quantix-final">
        <div className="small-label">
          <Sparkles size={12} /> Build your AI workforce
        </div>
        <h2>Your business should keep moving when you are not online.</h2>
        <p>
          Create your Fluxknight workspace and begin configuring the agents your team actually needs.
        </p>
        <div className="hero-buttons">
          <Link className="button-primary" href="/account/signup">
            Create Account <ArrowRight size={17} />
          </Link>
          <Link className="button-secondary" href="/account/login">Login</Link>
        </div>
      </section>
    </main>
  );
}
