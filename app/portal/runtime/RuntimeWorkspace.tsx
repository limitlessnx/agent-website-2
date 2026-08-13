"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Bot, Cable, CheckCircle2, Loader2, RefreshCw, Save, ShieldCheck } from "@/components/admin/ServerIcons";

type Agent = { id: string; name: string; status: string; agent_type: string | null; current_version: number; communication_channels: string[] };
type PromptBlock = { id?: string; agent_id: string; block_key: string; title: string; content: string; sort_order: number; status: string };
type KnowledgeSource = { id: string; collection_id: string | null; title: string; source_type: string; source_url: string | null; status: string };
type Readiness = { agent_id: string; score: number; blockers: string[]; checks: Record<string, boolean> };
type RuntimePayload = {
  agents: Agent[];
  prompt_blocks: PromptBlock[];
  collections: Array<{ id: string; name: string; source_count: number; status: string }>;
  sources: KnowledgeSource[];
  knowledge_bindings: Array<{ agent_id: string; collection_id: string; status: string }>;
  integration_requirements: Array<{ agent_id: string; channel: string; required: boolean; status: string }>;
  integrations: Array<{ id: string; provider: string; display_name: string; status: string }>;
  readiness: Readiness[];
};

const promptTemplates = [
  ["identity", "Identity"],
  ["business_context", "Business context"],
  ["responsibilities", "Responsibilities"],
  ["communication_style", "Communication style"],
  ["qualification_rules", "Qualification rules"],
  ["business_rules", "Business rules"],
  ["restrictions", "Restrictions"],
  ["escalation_rules", "Escalation rules"],
  ["channel_instructions", "Channel instructions"],
  ["closing_behavior", "Closing behaviour"],
] as const;

export default function RuntimeWorkspace() {
  const [data, setData] = useState<RuntimePayload | null>(null);
  const [agentId, setAgentId] = useState("");
  const [blocks, setBlocks] = useState<PromptBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [knowledgeSaving, setKnowledgeSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [knowledge, setKnowledge] = useState({ title: "", source_type: "manual_note", source_url: "", content: "" });

  async function load() {
    setLoading(true);
    const response = await fetch("/api/runtime", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) setMessage(result.error || "Unable to load runtime configuration.");
    else {
      setData(result);
      setAgentId((current) => current || result.agents?.[0]?.id || "");
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!data || !agentId) return;
    const saved = data.prompt_blocks.filter((block) => block.agent_id === agentId);
    setBlocks(promptTemplates.map(([key, title], index) => saved.find((block) => block.block_key === key) || { agent_id: agentId, block_key: key, title, content: "", sort_order: (index + 1) * 10, status: "active" }));
  }, [data, agentId]);

  const selectedAgent = data?.agents.find((agent) => agent.id === agentId);
  const selectedReadiness = data?.readiness.find((item) => item.agent_id === agentId);
  const requirements = data?.integration_requirements.filter((item) => item.agent_id === agentId) || [];
  const boundCollectionIds = new Set((data?.knowledge_bindings || []).filter((item) => item.agent_id === agentId && item.status === "active").map((item) => item.collection_id));
  const agentSources = (data?.sources || []).filter((source) => source.collection_id && boundCollectionIds.has(source.collection_id));
  const overall = useMemo(() => {
    if (!data?.readiness.length) return 0;
    return Math.floor(data.readiness.reduce((sum, item) => sum + item.score, 0) / data.readiness.length);
  }, [data]);

  function updateBlock(index: number, content: string) {
    setBlocks((current) => current.map((block, blockIndex) => blockIndex === index ? { ...block, content } : block));
  }

  async function savePrompts() {
    if (!agentId) return;
    setSaving(true); setMessage("");
    const response = await fetch("/api/runtime/prompts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent_id: agentId, blocks }) });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    setMessage(response.ok ? `Prompt version ${result.version} published.` : result.error || "Unable to save prompts.");
    if (response.ok) await load();
  }

  async function addKnowledge() {
    if (!agentId) return;
    setKnowledgeSaving(true); setMessage("");
    const response = await fetch("/api/runtime/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...knowledge, agent_id: agentId }) });
    const result = await response.json().catch(() => ({}));
    setKnowledgeSaving(false);
    setMessage(response.ok ? "Knowledge source added." : result.error || "Unable to add knowledge.");
    if (response.ok) { setKnowledge({ title: "", source_type: "manual_note", source_url: "", content: "" }); await load(); }
  }

  if (loading) return <main className="portal-page"><p><Loader2 className="spin" size={18} /> Loading tenant runtime…</p></main>;
  if (!data) return <main className="portal-page"><p>{message || "Runtime configuration unavailable."}</p></main>;

  return (
    <main className="portal-page">
      <header className="portal-section-title">
        <div><p className="admin-kicker">Tenant runtime</p><h1>Agent readiness and configuration</h1><p>Configure prompts, knowledge and required channels before approval and workflow activation.</p></div>
        <button type="button" onClick={load}><RefreshCw size={16} /> Refresh</button>
      </header>

      <section className="portal-metrics-grid">
        <article className="portal-metric"><span>Workspace readiness</span><strong>{overall}%</strong><small>Across purchased agents</small></article>
        <article className="portal-metric"><span>Provisioned agents</span><strong>{data.agents.length}</strong><small>Tenant-isolated</small></article>
        <article className="portal-metric"><span>Knowledge sources</span><strong>{data.sources.length}</strong><small>Private to this workspace</small></article>
        <article className="portal-metric"><span>Required connections</span><strong>{data.integration_requirements.length}</strong><small>WhatsApp, email, web, Telegram, voice</small></article>
      </section>

      <section className="portal-card">
        <div className="portal-card-head"><div><h2>Select an agent</h2><p>Every configuration below belongs only to the selected agent.</p></div><Bot size={20} /></div>
        <select value={agentId} onChange={(event) => setAgentId(event.target.value)}>
          {data.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · {agent.status}</option>)}
        </select>
        {selectedAgent && selectedReadiness ? <div className="portal-list-row"><div><strong>{selectedAgent.name}</strong><span>{selectedReadiness.blockers.length ? `Blocked by: ${selectedReadiness.blockers.join(", ")}` : "Ready for activation review"}</span></div><em>{selectedReadiness.score}%</em></div> : null}
      </section>

      <section className="portal-card">
        <div className="portal-card-head"><div><h2>Modular prompt manager</h2><p>These blocks assemble into one versioned system prompt.</p></div><ShieldCheck size={20} /></div>
        <div className="admin-form-grid">
          {blocks.map((block, index) => <label key={block.block_key} className="admin-form-wide"><span>{block.title}</span><textarea rows={4} value={block.content} onChange={(event) => updateBlock(index, event.target.value)} placeholder={`Define ${block.title.toLowerCase()} for this agent.`} /></label>)}
        </div>
        <button type="button" onClick={savePrompts} disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Publish prompt version</button>
      </section>

      <section className="portal-card">
        <div className="portal-card-head"><div><h2>Knowledge manager</h2><p>Add website links, FAQs, products, policies or manual knowledge after payment.</p></div><BookOpen size={20} /></div>
        <div className="admin-form-grid">
          <label><span>Title</span><input value={knowledge.title} onChange={(event) => setKnowledge((current) => ({ ...current, title: event.target.value }))} /></label>
          <label><span>Type</span><select value={knowledge.source_type} onChange={(event) => setKnowledge((current) => ({ ...current, source_type: event.target.value }))}><option value="manual_note">Manual note</option><option value="website">Website</option><option value="faq">FAQ</option><option value="product">Product catalogue</option><option value="policy">Policy</option><option value="pdf">PDF reference</option></select></label>
          <label className="admin-form-wide"><span>Source URL, optional</span><input value={knowledge.source_url} onChange={(event) => setKnowledge((current) => ({ ...current, source_url: event.target.value }))} placeholder="https://..." /></label>
          <label className="admin-form-wide"><span>Knowledge content, optional when URL is provided</span><textarea rows={6} value={knowledge.content} onChange={(event) => setKnowledge((current) => ({ ...current, content: event.target.value }))} /></label>
        </div>
        <button type="button" onClick={addKnowledge} disabled={knowledgeSaving}>{knowledgeSaving ? <Loader2 className="spin" size={16} /> : <BookOpen size={16} />} Add knowledge source</button>
        {agentSources.map((source) => <div className="portal-list-row" key={source.id}><div><strong>{source.title}</strong><span>{source.source_type}{source.source_url ? ` · ${source.source_url}` : ""}</span></div><em>{source.status}</em></div>)}
      </section>

      <section className="portal-card">
        <div className="portal-card-head"><div><h2>Integration requirements</h2><p>Connect capabilities in the Integration Centre. Provider choices remain super-admin only.</p></div><Cable size={20} /></div>
        {requirements.length ? requirements.map((requirement) => <div className="portal-list-row" key={requirement.channel}><div><strong>{requirement.channel.replaceAll("_", " ")}</strong><span>{requirement.required ? "Required for this agent" : "Optional"}</span></div><em>{requirement.status}</em></div>) : <p>No channel requirements have been created for this agent.</p>}
      </section>

      <section className="portal-card">
        <div className="portal-card-head"><div><h2>Activation gate</h2><p>The platform will not activate an agent until all required checks pass.</p></div><CheckCircle2 size={20} /></div>
        {selectedReadiness ? Object.entries(selectedReadiness.checks).map(([key, ready]) => <div className="portal-list-row" key={key}><div><strong>{key.replaceAll("_", " ")}</strong></div><em>{ready ? "Ready" : "Pending"}</em></div>) : null}
        {message ? <p>{message}</p> : null}
      </section>
    </main>
  );
}
