"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Check, Loader2, Settings2 } from "@/components/admin/ServerIcons";

type CatalogOffering = {
  agent_key: string;
  display_name: string;
  setup_price: number;
  monthly_price: number;
  currency: string;
  metadata?: Record<string, unknown>;
};

type Selection = {
  agent_key: string;
  status: string;
};

const money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

function description(item: CatalogOffering) {
  const value = item.metadata?.description;
  return typeof value === "string" && value.trim() ? value : "A standard Fluxknight agent configured for this business workspace.";
}

export default function AgentSelectionBuilder() {
  const [agents, setAgents] = useState<CatalogOffering[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [locked, setLocked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/agent-selections", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to load agent catalog.");
      const selections = (result.selections || []) as Selection[];
      setAgents(result.catalog || []);
      setSelected(selections.map((item) => item.agent_key));
      setLocked(selections.filter((item) => ["paid", "provisioning", "active"].includes(item.status)).map((item) => item.agent_key));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load agent catalog.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const totals = useMemo(() => agents
    .filter((agent) => selected.includes(agent.agent_key))
    .reduce((value, agent) => ({ setup: value.setup + Number(agent.setup_price), monthly: value.monthly + Number(agent.monthly_price) }), { setup: 0, monthly: 0 }), [agents, selected]);

  function toggle(key: string) {
    if (locked.includes(key)) return;
    setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/agent-selections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_keys: selected }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to save your package.");
      const selections = (result.selections || []) as Selection[];
      setSelected(selections.map((item) => item.agent_key));
      setLocked(selections.filter((item) => ["paid", "provisioning", "active"].includes(item.status)).map((item) => item.agent_key));
      setMessage("Your agent allocation is saved. An administrator can approve and provision it without Paystack for now.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save your package.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="admin-page">
      <header className="admin-page-header"><div><p className="admin-kicker">Agent marketplace</p><h1>Choose the AI employees your business needs.</h1><p>The catalog and pricing are loaded from the platform database, so the tenant and administrator use the same source of truth.</p></div></header>
      <section className="admin-panel"><div className="admin-list">
        {loading ? <p><Loader2 className="spin" size={16} /> Loading available agents...</p> : null}
        {!loading && agents.map((agent) => {
          const active = selected.includes(agent.agent_key);
          const isLocked = locked.includes(agent.agent_key);
          return <button type="button" key={agent.agent_key} className={`admin-list-row ${active ? "selected" : ""}`} onClick={() => toggle(agent.agent_key)} disabled={isLocked} style={{ width: "100%", textAlign: "left" }}>
            <span>{active ? <Check size={18} /> : <Bot size={18} />}</span><div style={{ flex: 1 }}><strong>{agent.display_name}</strong><span>{description(agent)}</span></div><em>{money.format(Number(agent.setup_price))} setup · {money.format(Number(agent.monthly_price))}/month{isLocked ? " · allocated" : ""}</em>
          </button>;
        })}
        {!loading && !agents.length ? <p>No active standard agents are available.</p> : null}
      </div></section>
      <section className="admin-panel"><div className="admin-panel-header"><div><h2>Package summary</h2><p>{selected.length} standard agent{selected.length === 1 ? "" : "s"} selected</p></div><Settings2 size={18} /></div><div className="admin-list-row"><div><strong>{money.format(totals.setup)} setup</strong><span>{money.format(totals.monthly)} recurring monthly, excluding usage-based provider costs.</span></div><button type="button" disabled={!selected.length || saving || loading} onClick={save}>{saving ? <Loader2 className="spin" size={16} /> : "Save allocation"}</button></div>{message ? <p>{message}</p> : null}</section>
      <section className="admin-panel"><div className="admin-panel-header"><div><h2>Need something custom?</h2><p>Submit the business process, platforms, required actions, budget range and target launch date for review.</p></div><Link href="/portal/agents/custom">Request custom build</Link></div></section>
    </main>
  );
}
