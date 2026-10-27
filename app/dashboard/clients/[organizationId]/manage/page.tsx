import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2, CreditCard, PlugZap, ShieldCheck, Users, Workflow } from "@/components/admin/ServerIcons";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import ClientStatusControl from "../../ClientStatusControl";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = { params: Promise<{ organizationId: string }> };
type MembershipRow = {
  id: string;
  user_id: string;
  status: string;
  membership_roles?: Array<{ roles?: { slug?: string; name?: string } | Array<{ slug?: string; name?: string }> | null }>;
};

function displayDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" }).format(date);
}
function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

export default async function OrganizationManagementPage({ params }: PageProps) {
  const session = await getAdminSession();
  if (!session) redirect("/login?next=/dashboard/clients");

  const { organizationId } = await params;
  if (!organizationId || organizationId.length > 128) notFound();
  const admin = createAdminClient();
  const [organizationResult, profileResult, integrationsResult, agentsResult, selectionsResult, subscriptionResult, membersResult] = await Promise.all([
    admin.from("organizations").select("id,name,slug,status,created_at").eq("id", organizationId).maybeSingle(),
    admin.from("client_onboarding_profiles").select("id,business_name,business_email,phone,industry,country,timezone,status,human_contact_name,human_contact_email,website").eq("organization_id", organizationId).maybeSingle(),
    admin.from("organization_integrations").select("id,provider,display_name,status,updated_at").eq("organization_id", organizationId).order("display_name"),
    admin.from("agents").select("id,name,status,agent_type").eq("organization_id", organizationId).order("created_at"),
    admin.from("organization_agent_selections").select("id,agent_key,status,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(50),
    admin.from("organization_subscriptions").select("id,status,provider,current_period_start,current_period_end,trial_ends_at,updated_at,billing_plans(name,slug)").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("organization_memberships").select("id,user_id,status,membership_roles(roles(slug,name))").eq("organization_id", organizationId).order("created_at", { ascending: true }).limit(100),
  ]);

  if (organizationResult.error || !organizationResult.data) notFound();
  if (profileResult.error) console.error("[organization-management] profile query failed", profileResult.error);
  if (integrationsResult.error) console.error("[organization-management] integrations query failed", integrationsResult.error);
  if (agentsResult.error) console.error("[organization-management] agents query failed", agentsResult.error);
  if (selectionsResult.error) console.error("[organization-management] allocations query failed", selectionsResult.error);
  if (subscriptionResult.error) console.error("[organization-management] subscription query failed", subscriptionResult.error);
  if (membersResult.error) console.error("[organization-management] memberships query failed", membersResult.error);

  const organization = organizationResult.data;
  const profile = profileResult.data;
  const integrations = integrationsResult.data || [];
  const agents = agentsResult.data || [];
  const selections = selectionsResult.data || [];
  const subscription = subscriptionResult.data as (Record<string, unknown> & { billing_plans?: { name?: string; slug?: string } | Array<{ name?: string; slug?: string }> | null }) | null;
  const members = (membersResult.data || []) as MembershipRow[];
  const roles = (row: MembershipRow) => (row.membership_roles || []).map((item) => relationOne(item.roles)?.name || relationOne(item.roles)?.slug || "Member").join(", ") || "No role assigned";
  const activeMembers = members.filter((member) => member.status === "active").length;
  const activeAgents = agents.filter((agent) => agent.status === "active").length;
  const activeIntegrations = integrations.filter((integration) => integration.status === "connected" || integration.status === "active").length;
  const plan = relationOne(subscription?.billing_plans as { name?: string; slug?: string } | Array<{ name?: string; slug?: string }> | null);

  return <main className="admin-page dashboard-v2-page">
    <header className="admin-page-header">
      <div><p className="admin-kicker">Super Admin · Organization Management</p><h1>{profile?.business_name || organization.name}</h1><p>One control surface for organization identity, lifecycle, subscription, agents, integrations and workspace access. Changes remain scoped to this tenant.</p></div>
      <Link className="admin-button secondary" href="/dashboard/clients"><ArrowLeft size={15}/> Back to organizations</Link>
    </header>

    <section className="admin-metric-grid">
      <article className="admin-metric-card"><p><Building2 size={15}/> Organization status</p><strong>{String(organization.status || "unknown").replaceAll("_"," ")}</strong><span>Created {displayDate(organization.created_at)}</span></article>
      <article className="admin-metric-card"><p><CreditCard size={15}/> Subscription</p><strong>{plan?.name || plan?.slug || "Not assigned"}</strong><span>{String(subscription?.status || "No subscription").replaceAll("_"," ")}</span></article>
      <article className="admin-metric-card"><p><Workflow size={15}/> Agents</p><strong>{activeAgents} active / {agents.length}</strong><span>{selections.length} allocation records</span></article>
      <article className="admin-metric-card"><p><PlugZap size={15}/> Integrations</p><strong>{activeIntegrations} connected</strong><span>{integrations.length} configured integrations</span></article>
      <article className="admin-metric-card"><p><Users size={15}/> Workspace access</p><strong>{activeMembers} active</strong><span>{members.length} membership records</span></article>
    </section>

    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>Organization profile</h2><p>Verified fields from the organization and onboarding profile.</p></div><ShieldCheck size={18}/></div>
      <div className="admin-form-grid">
        <div className="admin-list-row"><div><strong>Organization name</strong><span>{organization.name || "Not recorded"}</span></div></div>
        <div className="admin-list-row"><div><strong>Slug / ID</strong><span>{organization.slug || organization.id}</span></div></div>
        <div className="admin-list-row"><div><strong>Business email</strong><span>{profile?.business_email || "Not recorded"}</span></div></div>
        <div className="admin-list-row"><div><strong>Phone</strong><span>{profile?.phone || "Not recorded"}</span></div></div>
        <div className="admin-list-row"><div><strong>Industry</strong><span>{profile?.industry || "Not recorded"}</span></div></div>
        <div className="admin-list-row"><div><strong>Country / timezone</strong><span>{[profile?.country, profile?.timezone].filter(Boolean).join(" · ") || "Not recorded"}</span></div></div>
        <div className="admin-list-row"><div><strong>Human contact</strong><span>{profile?.human_contact_name || "Not recorded"} · {profile?.human_contact_email || "No contact email"}</span></div></div>
        <div className="admin-list-row"><div><strong>Website</strong><span>{profile?.website || "Not recorded"}</span></div></div>
      </div>
      <div className="admin-panel-header" style={{marginTop:20}}><div><h3>Lifecycle status</h3><p>Update onboarding lifecycle using the existing validated status endpoint.</p></div></div>
      {profile?.id ? <ClientStatusControl id={profile.id} value={profile.status || "submitted"}/> : <p className="admin-empty">No onboarding profile exists. Status cannot be changed here.</p>}
    </section>

    <section className="admin-grid two">
      <article className="admin-panel">
        <div className="admin-panel-header"><div><h2>Subscription & credits</h2><p>Current billing assignment and credit administration.</p></div><CreditCard size={18}/></div>
        <div className="admin-list-row"><div><strong>Plan</strong><span>{plan?.name || plan?.slug || "No billing plan assigned"}</span></div><em>{String(subscription?.status || "unassigned").replaceAll("_"," ")}</em></div>
        <div className="admin-list-row"><div><strong>Billing period</strong><span>{displayDate(subscription?.current_period_start as string)} – {displayDate(subscription?.current_period_end as string)}</span></div><em>{subscription?.trial_ends_at ? "Trial ends " + displayDate(subscription.trial_ends_at as string) : "No trial end"}</em></div>
        <div className="admin-actions" style={{marginTop:14,display:"flex",gap:8,flexWrap:"wrap"}}>
          <Link className="admin-button secondary" href={"/dashboard/billing?organizationId="+encodeURIComponent(organizationId)}>Open credit ledger</Link>
          <Link className="admin-button secondary" href={"/dashboard/scale?organizationId="+encodeURIComponent(organizationId)}>Plans & entitlements</Link>
        </div>
      </article>
      <article className="admin-panel">
        <div className="admin-panel-header"><div><h2>Agents & allocations</h2><p>Assigned workers and their current activation state.</p></div><Workflow size={18}/></div>
        <div className="admin-list">
          {agents.map((agent) => <div className="admin-list-row compact" key={agent.id}><div><strong>{agent.name}</strong><span>{String(agent.agent_type || "agent").replaceAll("_"," ")}</span></div><em>{String(agent.status).replaceAll("_"," ")}</em></div>)}
          {!agents.length ? <p className="admin-empty">No agent rows are configured.</p> : null}
        </div>
        {selections.length ? <div className="admin-list" style={{marginTop:12}}>{selections.slice(0,8).map((selection) => <div className="admin-list-row compact" key={selection.id}><div><strong>{String(selection.agent_key).replaceAll("_"," ")}</strong><span>Allocation record</span></div><em>{String(selection.status).replaceAll("_"," ")}</em></div>)}</div> : null}
        <div style={{marginTop:14}}><Link className="admin-button secondary" href={"/dashboard/clients/"+encodeURIComponent(organizationId)+"/setup#agents"}>Manage agent setup & allocation</Link></div>
      </article>
    </section>

    <section className="admin-grid two">
      <article className="admin-panel">
        <div className="admin-panel-header"><div><h2>Integrations</h2><p>Connection states for this organization only.</p></div><PlugZap size={18}/></div>
        <div className="admin-list">
          {integrations.map((integration) => <div className="admin-list-row compact" key={integration.id}><div><strong>{integration.display_name || integration.provider}</strong><span>{integration.provider} · Updated {displayDate(integration.updated_at)}</span></div><em>{String(integration.status).replaceAll("_"," ")}</em></div>)}
          {!integrations.length ? <p className="admin-empty">No integrations are configured.</p> : null}
        </div>
        <div style={{marginTop:14}}><Link className="admin-button secondary" href={"/dashboard/integrations?organizationId="+encodeURIComponent(organizationId)}>Manage integrations</Link></div>
      </article>
      <article className="admin-panel">
        <div className="admin-panel-header"><div><h2>Users & roles</h2><p>Current membership state and assigned tenant roles. This panel is read-only.</p></div><Users size={18}/></div>
        <div className="admin-list">
          {members.map((member) => <div className="admin-list-row compact" key={member.id}><div><strong>{member.user_id}</strong><span>{roles(member)}</span></div><em>{String(member.status).replaceAll("_"," ")}</em></div>)}
          {!members.length ? <p className="admin-empty">No membership records found.</p> : null}
        </div>
        <p className="admin-note">Role edits are not exposed here because there is no verified Super Admin membership-management workflow in this surface yet.</p>
      </article>
    </section>

    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>Lifecycle safeguards</h2><p>Pause, inspect or open the tenant workspace without bypassing the existing tenant controls.</p></div></div>
      <div className="admin-actions" style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <Link className="admin-button secondary" href={"/dashboard/clients/"+encodeURIComponent(organizationId)+"/inspect"}>Read-only inspection</Link>
        <Link className="admin-button secondary" href={"/dashboard/clients/"+encodeURIComponent(organizationId)+"/setup"}>Full setup</Link>
        <Link className="admin-button secondary" href={"/dashboard/preview/tenant/"+encodeURIComponent(organizationId)}>Open tenant preview</Link>
        <Link className="admin-button secondary" href={"/dashboard/switch/tenant/"+encodeURIComponent(organizationId)}>Open admin workspace</Link>
      </div>
      <p className="admin-note" style={{marginTop:14}}>Deletion is intentionally not exposed in this draft. A safe deletion lifecycle needs verified export, retention, ownership-transfer, dependency-cleanup and audit steps before any destructive control is added.</p>
    </section>
  </main>;
}
