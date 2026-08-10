import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  BrainCircuit,
  Building2,
  CheckCircle2,
  CircleDashed,
  FlaskConical,
  PlugZap,
  Rocket,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import AgentAllocationControl from "../../AgentAllocationControl";
import ClientModelAssignmentControl from "../../ClientModelAssignmentControl";
import ClientStatusControl from "../../ClientStatusControl";

export const dynamic = "force-dynamic";

type SetupPageProps = {
  params: Promise<{ organizationId: string }>;
};

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
  human_contact_name: string | null;
  human_contact_email: string | null;
};

type Organization = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

type Integration = {
  id: string;
  provider: string;
  display_name: string;
  status: string;
};

type Agent = {
  id: string;
  name: string;
  status: string;
  agent_type: string | null;
};

type Readiness = {
  agent_id: string;
  readiness_score: number | null;
};

type AiModel = {
  id: string;
  provider: string;
  model_key: string;
  display_name: string;
};

type ModelAssignment = {
  model_id: string;
};

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function stageState(complete: boolean) {
  return complete ? "admin-status live" : "admin-status warning";
}

export default async function TenantSetupPage({ params }: SetupPageProps) {
  const { organizationId } = await params;
  const admin = createAdminClient();

  const [organizationResult, profileResult, integrationsResult, agentsResult, readinessResult, modelsResult, modelAssignmentsResult] = await Promise.all([
    admin.from("organizations").select("id,name,slug,status").eq("id", organizationId).maybeSingle(),
    admin.from("client_onboarding_profiles").select("id,organization_id,status,business_name,business_email,industry,website,country,timezone,phone,human_contact_name,human_contact_email").eq("organization_id", organizationId).maybeSingle(),
    admin.from("organization_integrations").select("id,provider,display_name,status").eq("organization_id", organizationId).order("display_name"),
    admin.from("agents").select("id,name,status,agent_type").eq("organization_id", organizationId).order("created_at"),
    admin.from("agent_runtime_readiness").select("agent_id,readiness_score").eq("organization_id", organizationId),
    admin.from("ai_model_catalog").select("id,provider,model_key,display_name").eq("status", "active").order("provider").order("display_name"),
    admin.from("organization_ai_model_assignments").select("model_id").eq("organization_id", organizationId).order("assigned_at"),
  ]);

  if (organizationResult.error) throw organizationResult.error;
  if (!organizationResult.data) notFound();

  const organization = organizationResult.data as Organization;
  const profile = profileResult.data as OnboardingProfile | null;
  const integrations = (integrationsResult.data || []) as Integration[];
  const agents = (agentsResult.data || []) as Agent[];
  const readiness = (readinessResult.data || []) as Readiness[];
  const models = (modelsResult.data || []) as AiModel[];
  const modelAssignments = (modelAssignmentsResult.data || []) as ModelAssignment[];
  const currentModelIds = modelAssignments.map((assignment) => assignment.model_id);

  const businessComplete = Boolean(profile?.business_name && profile?.business_email);
  const agentsAllocated = agents.length > 0;
  const modelsAssigned = currentModelIds.length > 0;
  const integrationsConnected = integrations.length > 0 && integrations.every((item) => item.status === "connected");
  const testsReady = agents.length > 0 && readiness.length === agents.length && readiness.every((item) => Number(item.readiness_score || 0) >= 100);
  const isLive = profile?.status === "live";

  const steps = [
    { label: "Business", complete: businessComplete },
    { label: "Agents", complete: agentsAllocated },
    { label: "AI models", complete: modelsAssigned },
    { label: "Integrations", complete: integrationsConnected },
    { label: "Testing", complete: testsReady },
    { label: "Launch", complete: isLive },
  ];

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Tenant setup and agent allocation</p>
          <h1>{profile?.business_name || organization.name}</h1>
          <p>Build this workspace directly from the marketplace agents you assign. Fluxknight creates the tenant project, knowledge base, workflow bindings and required integration placeholders from those selections.</p>
        </div>
        <Link className="admin-button secondary" href="/dashboard/clients"><ArrowLeft size={15} /> Back to tenants</Link>
      </header>

      <section className="admin-panel">
        <div className="admin-list" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", display: "grid" }}>
          {steps.map((step, index) => (
            <div className="admin-list-row compact" key={step.label}>
              <span>{step.complete ? <CheckCircle2 size={16} /> : <CircleDashed size={16} />}</span>
              <div><strong>{index + 1}. {step.label}</strong><span>{step.complete ? "Complete" : "Needs attention"}</span></div>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-panel" id="business">
        <div className="admin-panel-header">
          <div><h2>1. Business details</h2><p>The tenant identity and operating context used across every allocated agent. Industry presets are not required.</p></div>
          <span className={stageState(businessComplete)}>{businessComplete ? "Ready" : "Needs details"}</span>
        </div>
        <div className="admin-form-grid">
          <div className="admin-list-row"><Building2 size={16} /><div><strong>Organization</strong><span>{profile?.business_name || organization.name}</span></div></div>
          <div className="admin-list-row"><div><strong>Business email</strong><span>{profile?.business_email || "Not provided"}</span></div></div>
          <div className="admin-list-row"><div><strong>Industry</strong><span>{profile?.industry || "Optional / not provided"}</span></div></div>
          <div className="admin-list-row"><div><strong>Country and timezone</strong><span>{profile?.country || "Not provided"} · {profile?.timezone || "Not provided"}</span></div></div>
          <div className="admin-list-row"><div><strong>Website</strong><span>{profile?.website || "Not provided"}</span></div></div>
          <div className="admin-list-row"><div><strong>Human contact</strong><span>{profile?.human_contact_name || "Not provided"} · {profile?.human_contact_email || profile?.phone || "No contact supplied"}</span></div></div>
        </div>
      </section>

      <section className="admin-panel" id="agents">
        <div className="admin-panel-header">
          <div><h2>2. Agent allocation and workspace build</h2><p>Select the reusable marketplace agent(s) assigned to this tenant. Saving the allocation builds or updates the workspace automatically from those selections. The client plan controls how many agents can be allocated; channels and integrations are configured separately.</p></div>
          <Bot size={18} />
        </div>
        <AgentAllocationControl organizationId={organizationId} embedded />
        {agents.length ? (
          <div className="admin-list" style={{ marginTop: 16 }}>
            {agents.map((agent) => (
              <div className="admin-list-row compact" key={agent.id}>
                <Bot size={15} />
                <div><strong>{agent.name}</strong><span>{humanize(agent.agent_type || "general agent")}</span></div>
                <em className={agent.status === "active" ? "good" : "muted"}>{humanize(agent.status)}</em>
              </div>
            ))}
          </div>
        ) : <p className="admin-empty">No tenant agents are provisioned yet. Choose marketplace agents above and save to build the workspace.</p>}
      </section>

      <section className="admin-panel" id="ai-model">
        <div className="admin-panel-header">
          <div><h2>3. AI model access</h2><p>Assign one or more approved AI models to this organization. Model count is controlled by Super Admin and is not restricted by the client plan.</p></div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BrainCircuit size={18} />
            <span className={stageState(modelsAssigned)}>{currentModelIds.length} assigned</span>
          </div>
        </div>
        <ClientModelAssignmentControl organizationId={organizationId} models={models} currentModelIds={currentModelIds} />
      </section>

      <section className="admin-panel" id="integrations">
        <div className="admin-panel-header">
          <div><h2>4. Integrations and webhooks</h2><p>Connect the tenant-owned APIs, credentials and communication channels required by the allocated agents. Agent role and communication channel are separate, so a Support Agent can use WhatsApp, email or web chat as configured.</p></div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className={stageState(integrationsConnected)}>{integrations.filter((item) => item.status === "connected").length}/{integrations.length} connected</span>
            <Link className="admin-button secondary" href="/dashboard/integrations">Configure integrations</Link>
          </div>
        </div>
        <div className="admin-list">
          {integrations.map((integration) => (
            <div className="admin-list-row" key={integration.id}>
              <PlugZap size={16} />
              <div><strong>{integration.display_name}</strong><span>{humanize(integration.provider)}</span></div>
              <em className={integration.status === "connected" ? "good" : "muted"}>{humanize(integration.status)}</em>
            </div>
          ))}
          {!integrations.length ? <p className="admin-empty">No integration requirements yet. Required placeholders are created from the marketplace agents you allocate.</p> : null}
        </div>
      </section>

      <section className="admin-panel" id="testing">
        <div className="admin-panel-header">
          <div><h2>5. Testing and readiness</h2><p>Every agent must reach full runtime readiness before launch.</p></div>
          <FlaskConical size={18} />
        </div>
        <div className="admin-list">
          {agents.map((agent) => {
            const snapshot = readiness.find((item) => item.agent_id === agent.id);
            const percentage = Number(snapshot?.readiness_score || 0);
            return (
              <div className="admin-list-row" key={agent.id}>
                <div><strong>{agent.name}</strong><span>Configuration, knowledge, integrations, workflow assignment, testing and approval</span></div>
                <em className={percentage >= 100 ? "good" : "muted"}>{percentage}% ready</em>
              </div>
            );
          })}
          {!agents.length ? <p className="admin-empty">Testing becomes available after agents are provisioned.</p> : null}
        </div>
      </section>

      <section className="admin-panel" id="launch">
        <div className="admin-panel-header">
          <div><h2>6. Launch control</h2><p>Move the tenant through configuration, testing, approval and live operation only after the setup checks above are complete.</p></div>
          <Rocket size={18} />
        </div>
        {profile ? (
          <div className="admin-list-row">
            <div><strong>Deployment status</strong><span>Current stage: {humanize(profile.status)}</span></div>
            <ClientStatusControl id={profile.id} value={profile.status} />
          </div>
        ) : <p className="admin-empty">No onboarding profile is attached to this organization.</p>}
        {!testsReady && profile?.status === "live" ? <p className="admin-form-message">Warning: this tenant is marked live but one or more agents have not reached 100% readiness.</p> : null}
      </section>
    </main>
  );
}
