import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, BrainCircuit, Building2, CheckCircle2, CircleDashed, FlaskConical, PlugZap, Rocket, Workflow } from "@/components/admin/ServerIcons";
import { createAdminClient } from "@/lib/supabase/admin";
import AgentAllocationControl from "../../AgentAllocationControl";
import AgentConfigurationControl from "../../AgentConfigurationControl";
import ClientModelAssignmentControl from "../../ClientModelAssignmentControl";
import ClientStatusControl from "../../ClientStatusControl";
import ClientTestingApprovalControl from "../../ClientTestingApprovalControl";
import MaiaRuntimeControl from "../../MaiaRuntimeControl";
import ProvisionFromBriefControl from "../../ProvisionFromBriefControl";

export const dynamic = "force-dynamic";

const TENANT_CONFIGURABLE_PROVIDERS = new Set(["whatsapp", "telegram", "email", "elevenlabs", "google_calendar", "google_sheets", "sms"]);

type SetupPageProps = { params: Promise<{ organizationId: string }> };
type OnboardingProfile = {
  id: string;
  organization_id: string;
  status: string;
  business_name: string | null;
  business_email: string | null;
  industry: string | null;
  website: string | null;
  country: string | null;
  timezone: string | null;
  phone: string | null;
  business_description: string | null;
  ai_requirements: string | null;
  business_knowledge: Record<string, unknown> | null;
  whatsapp_preferences: { connection_path?: string; preferred_number?: string } | null;
  human_contact_name: string | null;
  human_contact_email: string | null;
};
type Organization = { id: string; name: string; slug: string; status: string };
type Integration = { id: string; provider: string; display_name: string; status: string };
type Agent = { id: string; name: string; status: string; agent_type: string | null; system_prompt: string | null; communication_channels: string[] };
type Readiness = { agent_id: string; readiness_score: number | null };
type AiModel = { id: string; provider: string; model_key: string; display_name: string };
type ModelAssignment = { model_id: string };

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function stageState(complete: boolean) {
  return complete ? "admin-status live" : "admin-status warning";
}

function knowledgeEntries(value: Record<string, unknown> | null | undefined) {
  return Object.entries(value || {}).filter(([, item]) => {
    if (item === null || item === undefined) return false;
    if (typeof item === "string") return item.trim().length > 0;
    if (Array.isArray(item)) return item.length > 0;
    return true;
  });
}

export default async function TenantSetupPage({ params }: SetupPageProps) {
  const { organizationId } = await params;
  const admin = createAdminClient();

  const [
    organizationResult,
    profileResult,
    integrationsResult,
    agentsResult,
    readinessResult,
    modelsResult,
    modelAssignmentsResult,
  ] = await Promise.all([
    admin.from("organizations").select("id,name,slug,status").eq("id", organizationId).maybeSingle(),
    admin.from("client_onboarding_profiles").select(
      "id,organization_id,status,business_name,business_email,industry,website,country,timezone,phone,business_description,ai_requirements,business_knowledge,whatsapp_preferences,human_contact_name,human_contact_email"
    ).eq("organization_id", organizationId).maybeSingle(),
    admin.from("organization_integrations").select("id,provider,display_name,status").eq("organization_id", organizationId).order("display_name"),
    admin.from("agents").select("id,name,status,agent_type,system_prompt,communication_channels").eq("organization_id", organizationId).order("created_at"),
    admin.from("agent_runtime_readiness").select("agent_id,readiness_score").eq("organization_id", organizationId),
    admin.from("ai_model_catalog").select("id,provider,model_key,display_name").eq("status", "active").order("provider").order("display_name"),
    admin.from("organization_ai_model_assignments").select("model_id").eq("organization_id", organizationId).order("assigned_at"),
  ]);

  if (organizationResult.error) throw organizationResult.error;
  if (!organizationResult.data) notFound();

  const organization = organizationResult.data as Organization;
  const profile = profileResult.data as OnboardingProfile | null;
  const allIntegrations = (integrationsResult.data || []) as Integration[];
  const integrations = allIntegrations.filter((item) => TENANT_CONFIGURABLE_PROVIDERS.has(item.provider));
  const agents = (agentsResult.data || []) as Agent[];
  const readiness = (readinessResult.data || []) as Readiness[];
  const models = (modelsResult.data || []) as AiModel[];
  const modelAssignments = (modelAssignmentsResult.data || []) as ModelAssignment[];
  const currentModelIds = modelAssignments.map((assignment) => assignment.model_id);
  const knowledge = knowledgeEntries(profile?.business_knowledge);

  const businessComplete = Boolean(profile?.business_name && profile?.business_email);
  const briefComplete = Boolean(profile?.business_description?.trim() && profile?.ai_requirements?.trim());
  const knowledgeComplete = knowledge.length > 0;
  const whatsappConnected = integrations.some((item) => item.provider === "whatsapp" && item.status === "connected");
  const agentsAllocated = agents.length > 0;
  const agentsConfigured = agents.length > 0 && agents.every((agent) => Boolean(agent.system_prompt?.trim()));
  const modelsAssigned = currentModelIds.length > 0;
  const testsReady = agents.length > 0 && readiness.length === agents.length && readiness.every((item) => Number(item.readiness_score || 0) >= 100);
  const isLive = profile?.status === "live";

  const steps = [
    { label: "Review brief", complete: businessComplete && briefComplete && knowledgeComplete },
    { label: "Build AI team", complete: agentsAllocated },
    { label: "Configure", complete: agentsConfigured },
    { label: "Connect WhatsApp", complete: whatsappConnected },
    { label: "Test", complete: testsReady },
    { label: "Launch", complete: isLive },
  ];

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Client setup</p>
          <h1>{profile?.business_name || organization.name}</h1>
          <p>Turn the client's business brief into a tested AI system. The client supplied the business context. Fluxknight handles the technical build.</p>
        </div>
        <Link className="admin-button secondary" href="/dashboard/clients"><ArrowLeft size={15} /> Back to clients</Link>
      </header>

      <section className="admin-panel">
        <div className="admin-list" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", display: "grid" }}>
          {steps.map((step, index) => (
            <div className="admin-list-row compact" key={step.label}>
              <span>{step.complete ? <CheckCircle2 size={16} /> : <CircleDashed size={16} />}</span>
              <div><strong>{index + 1}. {step.label}</strong><span>{step.complete ? "Complete" : "Needs attention"}</span></div>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-panel" id="brief">
        <div className="admin-panel-header">
          <div><p className="admin-kicker">Client brief</p><h2>What the client asked Fluxknight to build</h2><p>Review this before configuring anything. It is the source of truth for the initial AI setup.</p></div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}><span className={stageState(businessComplete && briefComplete && knowledgeComplete)}>{businessComplete && briefComplete && knowledgeComplete ? "Brief ready" : "Review needed"}</span>{profile ? <ProvisionFromBriefControl organizationId={organizationId} disabled={!(businessComplete && briefComplete && knowledgeComplete)} /> : null}</div>
        </div>
        <div className="admin-form-grid">
          <div className="admin-list-row"><Building2 size={16} /><div><strong>Business</strong><span>{profile?.business_name || organization.name} · {profile?.industry || "Business type not provided"}</span></div></div>
          <div className="admin-list-row"><div><strong>Contact</strong><span>{profile?.business_email || "No business email"} · {profile?.phone || "No phone provided"}</span></div></div>
          <div className="admin-list-row"><div><strong>Website</strong><span>{profile?.website || "Not provided"}</span></div></div>
          <div className="admin-list-row"><div><strong>Location</strong><span>{profile?.country || "Not provided"} · {profile?.timezone || "Not provided"}</span></div></div>
        </div>
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <div className="admin-list-row" style={{ alignItems: "flex-start" }}><div><strong>Business description</strong><span style={{ whiteSpace: "pre-wrap" }}>{profile?.business_description || "Not provided."}</span></div></div>
          <div className="admin-list-row" style={{ alignItems: "flex-start" }}><div><strong>AI responsibilities</strong><span style={{ whiteSpace: "pre-wrap" }}>{profile?.ai_requirements || "Not provided."}</span></div></div>
          <div className="admin-list-row" style={{ alignItems: "flex-start" }}>
            <div><strong>Business knowledge</strong><span>{knowledge.length ? knowledge.map(([key, value]) => `${key.replaceAll("_", " ")}: ${Array.isArray(value) ? value.join(", ") : String(value)}`).join(" · ") : "Not provided."}</span></div>
          </div>
        </div>
      </section>

      <section className="admin-panel" id="whatsapp">
        <div className="admin-panel-header">
          <div><p className="admin-kicker">Channel</p><h2>WhatsApp</h2><p>Connect the customer's WhatsApp Business number. Credentials and provider configuration remain behind the platform boundary.</p></div>
          <span className={stageState(whatsappConnected)}>{whatsappConnected ? "Connected" : "Awaiting connection"}</span>
        </div>
        <div className="admin-list-row">
          <div><strong>Client preference</strong><span>{profile?.whatsapp_preferences?.connection_path === "already_have_whatsapp_business" ? "Client already has a WhatsApp Business number" : "Client requested help setting up WhatsApp"}</span></div>
          <div><strong>Preferred number</strong><span>{profile?.whatsapp_preferences?.preferred_number || "Not provided"}</span></div>
          <Link className="admin-button secondary" href={`/dashboard/integrations?organizationId=${encodeURIComponent(organizationId)}`}>Open WhatsApp setup</Link>
        </div>
        <div className="admin-list" style={{ marginTop: 12 }}>
          {integrations.filter((item) => item.provider === "whatsapp").map((item) => <div className="admin-list-row compact" key={item.id}><PlugZap size={15} /><div><strong>{item.display_name}</strong><span>Managed WhatsApp Business connection</span></div><em className={item.status === "connected" ? "good" : "muted"}>{humanize(item.status)}</em></div>)}
          {!integrations.some((item) => item.provider === "whatsapp") ? <p className="admin-empty">No WhatsApp connection has been created yet.</p> : null}
        </div>
      </section>

      <section className="admin-panel" id="agents">
        <div className="admin-panel-header"><div><p className="admin-kicker">Build</p><h2>AI team</h2><p>Choose the reusable AI workers that match the client's requested outcomes. Fluxknight owns the technical provisioning.</p></div><Bot size={18} /></div>
        <AgentAllocationControl organizationId={organizationId} embedded />
        {agents.length ? <div className="admin-list" style={{ marginTop: 16 }}>{agents.map((agent) => <div className="admin-list-row compact" key={agent.id}><Bot size={15} /><div><strong>{agent.name}</strong><span>{humanize(agent.agent_type || "general agent")}</span></div><em className={agent.status === "active" ? "good" : "muted"}>{humanize(agent.status)}</em></div>)}</div> : <p className="admin-empty">No AI workers have been assigned yet.</p>}
      </section>

      <section className="admin-panel" id="configuration">
        <div className="admin-panel-header"><div><p className="admin-kicker">Configure</p><h2>Make the AI behave like this business</h2><p>Build each agent's instructions from the submitted brief, then review channels and automation routes.</p></div><Workflow size={18} /></div>
        <AgentConfigurationControl organizationId={organizationId} />
      </section>

      <section className="admin-panel" id="intelligence">
        <div className="admin-panel-header"><div><p className="admin-kicker">Runtime</p><h2>Agentic capabilities</h2><p>Enable the runtime capabilities required by the assigned agents. Platform credentials remain centralized.</p></div><BrainCircuit size={18} /></div>
        {agents.length ? agents.map((agent) => <div key={agent.id} style={{ marginBottom: 16 }}><MaiaRuntimeControl organizationId={organizationId} agentId={agent.id} agentName={agent.name} /></div>) : <p className="admin-empty">Assign an AI worker first.</p>}
      </section>

      <section className="admin-panel" id="models">
        <div className="admin-panel-header"><div><p className="admin-kicker">Platform</p><h2>Approved AI models</h2><p>Assign the approved models this tenant's agents may use. Provider credentials remain centralized.</p></div><BrainCircuit size={18} /></div>
        <ClientModelAssignmentControl organizationId={organizationId} models={models} currentModelIds={currentModelIds} />
      </section>

      <section className="admin-panel" id="testing">
        <div className="admin-panel-header"><div><p className="admin-kicker">Quality gate</p><h2>Test before launch</h2><p>Every assigned agent must reach full runtime readiness before the tenant is marked live.</p></div><FlaskConical size={18} /></div>
        <div className="admin-list">
          {agents.map((agent) => {
            const snapshot = readiness.find((item) => item.agent_id === agent.id);
            const percentage = Number(snapshot?.readiness_score || 0);
            return <div className="admin-list-row" key={agent.id}><div><strong>{agent.name}</strong><span>Prompt, knowledge, channels, workflows, model access and runtime</span></div><em className={percentage >= 100 ? "good" : "muted"}>{percentage}% ready</em></div>;
          })}
          {!agents.length ? <p className="admin-empty">Assign an AI worker before testing.</p> : null}
        </div>
        {agents.length ? <ClientTestingApprovalControl organizationId={organizationId} agents={agents.map((agent) => ({ id: agent.id, name: agent.name }))} /> : null}
      </section>

      <section className="admin-panel" id="launch">
        <div className="admin-panel-header"><div><p className="admin-kicker">Release</p><h2>Launch</h2><p>Only move to live after the setup and testing gates are complete.</p></div><Rocket size={18} /></div>
        <div className="admin-list-row">
          <div><strong>Current status</strong><span>{humanize(profile?.status || "not started")}</span></div>
          {profile ? <ClientStatusControl id={profile.id} value={profile.status} /> : null}
        </div>
        {!testsReady && profile?.status === "live" ? <p className="admin-form-message">This tenant is marked live, but one or more agents are below full readiness. Review the test gate before keeping it live.</p> : null}
      </section>
    </main>
  );
}
