"use client";

import { useEffect, useState } from "react";
import AIPresence from "@/components/ui/AIPresence";
import { type AIPresenceState } from "@/lib/ai-presence";
import { BrainCircuit, CheckCircle2, Cpu, ShieldCheck, Zap } from "lucide-react";

type Props = { organizationId: string; agentId: string; agentName: string };

type Profile = { enabled: boolean; autonomy_mode: "supervised" | "autonomous"; max_steps: number; model_strategy: "best_available" | "fastest" | "reasoning" | "balanced"; memory_enabled: boolean; tool_policy: Record<string, unknown> };

type Model = { model_id: string; ai_model_catalog?: { id: string; provider: string; model_key: string; display_name: string; status: string } };

const defaultProfile: Profile = { enabled: true, autonomy_mode: "autonomous", max_steps: 8, model_strategy: "best_available", memory_enabled: true, tool_policy: {} };

export default function MaiaRuntimeControl({ organizationId, agentId, agentName }: Props) {
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [models, setModels] = useState<Model[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [feedbackState, setFeedbackState] = useState<AIPresenceState>("idle");

  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadedFor, setLoadedFor] = useState("");
  const [hasProfile, setHasProfile] = useState(false);
  const loadKey = `${organizationId}:${agentId}`;
  useEffect(() => {
    let active = true;
    async function loadRuntime() {
      try {
        const response = await fetch(`/api/admin/maia-runtime?organizationId=${encodeURIComponent(organizationId)}&agentId=${encodeURIComponent(agentId)}`, { cache: "no-store" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Unable to load agentic runtime.");
        if (!active) return;
        setProfile({ ...defaultProfile, ...(result.profile || {}) });
        setModels(result.models || []); setHasProfile(Boolean(result.profile)); setLoadFailed(false); setFeedbackState("idle");
      } catch (error) {
        if (active) { setLoadFailed(true); setFeedbackState("error"); setMessage(error instanceof Error ? error.message : "Unable to load agentic runtime."); }
      } finally { if (active) { setLoading(false); setLoadedFor(loadKey); } }
    }
    void loadRuntime();
    return () => { active = false; };
  }, [organizationId, agentId, loadAttempt, loadKey]);

  async function save() {
    setSaving(true); setMessage(""); setFeedbackState("executing");
    try {
      const response = await fetch("/api/admin/maia-runtime", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, agentId, enabled: profile.enabled, autonomyMode: profile.autonomy_mode, maxSteps: profile.max_steps, modelStrategy: profile.model_strategy, memoryEnabled: profile.memory_enabled, toolPolicy: profile.tool_policy }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to save agentic runtime.");
      setProfile(result.profile); setHasProfile(true); setFeedbackState("completed");
      setMessage(`${agentName} agentic runtime saved.`);
    } catch (error) { setFeedbackState("error"); setMessage(error instanceof Error ? error.message : "Unable to save agentic runtime."); }
    finally { setSaving(false); }
  }

  if (loading || loadedFor !== loadKey) return <AIPresence state="processing" name={agentName} label="Loading runtime configuration" />;
  if (loadFailed) return <div className="maia-runtime-controls"><AIPresence state="error" name={agentName} label="Runtime configuration unavailable" /><p role="alert">{message}</p><button type="button" className="admin-button secondary" onClick={() => { setLoading(true); setMessage(""); setFeedbackState("processing"); setLoadAttempt(value => value + 1); }}>Retry runtime configuration</button></div>;

  return (
    <div className="maia-runtime-controls" style={{ display: "grid", gap: 14 }} onChange={() => setFeedbackState("idle")}>
      <AIPresence state={feedbackState} name={agentName} label={saving ? "Saving runtime settings" : feedbackState === "completed" ? "Runtime settings saved" : feedbackState === "error" ? "Settings could not be saved" : !hasProfile ? "Default runtime configuration" : profile.enabled ? "Runtime enabled in configuration" : "Runtime disabled in configuration"} />
      <div className="admin-list-row" style={{ alignItems: "flex-start" }}>
        <BrainCircuit size={18} />
        <div style={{ flex: 1 }}>
          <strong>{agentName} · Agentic Intelligence</strong>
          <span>Models, memory, tools and autonomous execution are selected by the runtime. You do not configure Supabase, n8n or platform API credentials here.</span>
        </div>
        <em className={profile.enabled ? "good" : "muted"}>{!hasProfile ? "defaults" : profile.enabled ? "enabled" : "paused"}</em>
      </div>

      <div className="admin-form-grid">
        <label className="admin-list-row compact" style={{ cursor: "pointer" }}><input type="checkbox" checked={profile.enabled} onChange={(e) => setProfile((p) => ({ ...p, enabled: e.target.checked }))} /><span>Enable agentic runtime</span></label>
        <label className="admin-list-row compact" style={{ cursor: "pointer" }}><input type="checkbox" checked={profile.memory_enabled} onChange={(e) => setProfile((p) => ({ ...p, memory_enabled: e.target.checked }))} /><span>Use tenant-scoped conversation memory</span></label>
      </div>

      <div className="admin-form-grid">
        <label style={{ display: "grid", gap: 6 }}><span>Autonomy</span><select className="admin-input" value={profile.autonomy_mode} onChange={(e) => setProfile((p) => ({ ...p, autonomy_mode: e.target.value as Profile["autonomy_mode"] }))}><option value="autonomous">Autonomous low-risk operation</option><option value="supervised">Supervised operation</option></select></label>
        <label style={{ display: "grid", gap: 6 }}><span>Model strategy</span><select className="admin-input" value={profile.model_strategy} onChange={(e) => setProfile((p) => ({ ...p, model_strategy: e.target.value as Profile["model_strategy"] }))}><option value="best_available">Best available</option><option value="balanced">Balanced</option><option value="reasoning">Reasoning first</option><option value="fastest">Fastest available</option></select></label>
        <label style={{ display: "grid", gap: 6 }}><span>Maximum tool steps</span><input className="admin-input" type="number" min={1} max={20} value={profile.max_steps} onChange={(e) => setProfile((p) => ({ ...p, max_steps: Number(e.target.value || 8) }))} /></label>
      </div>

      <div className="admin-list-row compact" style={{ alignItems: "flex-start" }}>
        <Cpu size={16} />
        <div style={{ flex: 1 }}><strong>Approved models available to this tenant</strong><span>{models.length ? models.map((item) => `${item.ai_model_catalog?.display_name || item.ai_model_catalog?.model_key} · ${item.ai_model_catalog?.provider}`).join(" · ") : "No catalog model is assigned yet. Runtime will use MAIA_DEFAULT_MODEL/SUPPORT_AI_MODEL only when a server-side OpenAI key is configured."}</span></div>
      </div>

      <div className="admin-list" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
        <div className="admin-list-row compact"><Zap size={15} /><div><strong>Plan-independent</strong><span>Runtime capability is controlled by Super Admin, not the client plan.</span></div></div>
        <div className="admin-list-row compact"><ShieldCheck size={15} /><div><strong>Tenant isolated</strong><span>Tools are scoped to this organization and assigned agents.</span></div></div>
        <div className="admin-list-row compact"><CheckCircle2 size={15} /><div><strong>Autonomous</strong><span>Can inspect, reason, act on low-risk tasks and hand off work.</span></div></div>
      </div>

      <button className="admin-button" type="button" disabled={saving} onClick={save}>{saving ? "Saving runtime..." : "Save agentic intelligence"}</button>
      {message ? <p className="admin-form-message" role={feedbackState === "error" ? "alert" : "status"}>{message}</p> : null}
    </div>
  );
}
