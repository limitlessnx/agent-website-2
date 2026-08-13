"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Bot, CircleAlert, Clock3, MessagesSquare, RefreshCw } from "@/components/admin/ServerIcons";

type Overview = {
  conversations: Array<{ id:string; channel:string; status:string; current_stage:string|null; ai_paused:boolean; last_message_at:string|null }>;
  executions: Array<{ id:string; status:string; latency_ms:number|null; cost_minor:number; error_code:string|null; created_at:string }>;
  handoffs: Array<{ id:string; reason:string; priority:string; status:string; created_at:string }>;
  usage: Array<{ usage_type:string; quantity:number; total_cost_minor:number }>;
};

export default function ExecutionPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true); setError("");
    const response = await fetch("/api/runtime/overview", { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setError(result.error || "Unable to load runtime."); else setData(result);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);
  const totals = useMemo(() => ({
    open: data?.conversations.filter((item) => item.status === "open").length || 0,
    queued: data?.executions.filter((item) => ["queued","running"].includes(item.status)).length || 0,
    handoffs: data?.handoffs.filter((item) => ["open","assigned"].includes(item.status)).length || 0,
    cost: data?.usage.reduce((sum, item) => sum + Number(item.total_cost_minor || 0), 0) || 0,
  }), [data]);
  return <main className="portal-page">
    <header className="portal-section-title"><div><p className="admin-kicker">Phase 11</p><h1>Agent execution</h1><p>Conversations, handoffs, execution traces and usage for this organisation. Live model and n8n dispatch remain disabled.</p></div><button type="button" onClick={load} disabled={loading}><RefreshCw size={16}/> Refresh</button></header>
    {error ? <section className="portal-card"><p>{error}</p></section> : null}
    <section className="portal-stat-grid">
      <article><MessagesSquare size={18}/><span>Open conversations</span><strong>{totals.open}</strong></article>
      <article><Activity size={18}/><span>Queued executions</span><strong>{totals.queued}</strong></article>
      <article><CircleAlert size={18}/><span>Human handoffs</span><strong>{totals.handoffs}</strong></article>
      <article><Clock3 size={18}/><span>Tracked cost</span><strong>{totals.cost}</strong></article>
    </section>
    <section className="portal-card"><div className="portal-card-head"><div><h2>Recent conversations</h2><p>Unified across WhatsApp, email, web chat, Telegram and voice.</p></div><MessagesSquare size={20}/></div>
      {data?.conversations.length ? data.conversations.map((row) => <div className="portal-list-row" key={row.id}><div><strong>{row.channel.replace("_", " ")}</strong><span>{row.current_stage || "No stage"} · {row.ai_paused ? "AI paused" : "AI available"}</span></div><em>{row.status}</em></div>) : <p>No conversations yet.</p>}
    </section>
    <section className="portal-card"><div className="portal-card-head"><div><h2>Execution history</h2><p>Immutable runtime traces appear here after requests are queued.</p></div><Bot size={20}/></div>
      {data?.executions.length ? data.executions.map((row) => <div className="portal-list-row" key={row.id}><div><strong>{row.id.slice(0,8)}</strong><span>{row.error_code || "No runtime error"} · {row.latency_ms ?? 0}ms</span></div><em>{row.status}</em></div>) : <p>No executions yet.</p>}
    </section>
  </main>;
}
