import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ShieldCheck,
  Workflow,
} from "@/components/admin/ServerIcons";
import PlanEntitlementsPanel from "@/components/portal/PlanEntitlementsPanel";
import TrialActivationButton from "./TrialActivationButton";
import { getClientSession } from "@/lib/client-auth";
import { getClientPortalSummary, type PortalAgent, type PortalWorkflow, type PortalWorkflowRun } from "@/lib/client-portal-data";
import { getActiveFluxSubscription, getFluxWalletSummary } from "@/lib/flux-credits";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIndustryExperience } from "@/lib/industryExperience";
import { getProperties } from "@/lib/limitless-data";
import { getCampaignAudienceLeads } from "@/lib/lead-profile-service";
import OrganizationDashboard from "@/components/portal/OrganizationDashboard";
import PhotographyDashboard from "@/components/portal/PhotographyDashboard";
import HotelOverviewPage from "@/components/portal/hotel/HotelOverviewPage";
import { getClientOnboardingProfile, getClientWorkspaceIndustry } from "@/lib/client-workspace-onboarding";
import { getPortalCapabilities } from "@/lib/portal-access";
import { getWorkspaceHealth, getWorkspaceModules } from "@/lib/workspace-overview";
import WorkspacePresetPanel from "@/components/portal/WorkspacePresetPanel";
import workspaceStyles from "@/components/portal/WorkspacePresetPanel.module.css";

export const metadata = { title: "Client Portal | Fluxknight" };
export const dynamic = "force-dynamic";
type XposureCategoryRow = { id: string; name: string; cover_image_url: string | null; display_order: number };
type XposureItemRow = { category_id: string };
type XposureCustomerRow = { id: string; full_name: string | null; phone: string | null; email: string | null; status: string | null; metadata: unknown };
type XposureBookingRow = { id: string; title: string | null; start_at: string | null; status: string | null; customer_name: string | null; location: string | null };
type XposureBookingMetadataRow = { appointment_id: string; assigned_photographer_id: string | null; deposit_status: string | null; delivery_status: string | null };
type WhatsAppStatus = { status?: string | null; sender_phone_e164?: string | null };
type EvaluationDetails = { specificity?: string; details?: string };
type EvaluationRecord = { pricingType?: string; summary?: string; score?: number; opportunity?: string; recommendedSystem?: string; recommendedPlan?: string; requirements?: EvaluationDetails };

function formatDate(value?: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function trialDaysRemaining(trialEndsAt: string | null) {
  if (!trialEndsAt) return null;
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000));
}

function friendlyWorkflowName(value: string) {
  return String(value || "")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function ClientPortalPage({ searchParams }: { searchParams?: Promise<{ evaluation?: string }> }) {
  const session = await getClientSession();
  if (!session) return null;

  const admin = createAdminClient();
  const params = searchParams ? await searchParams : {};
  const evaluationId = typeof params.evaluation === "string" ? params.evaluation.trim() : "";
  if (evaluationId) {
    await admin.from("ai_business_evaluation_sessions").update({ organization_id: session.organizationId, user_id: session.userId, claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", evaluationId).eq("status", "evaluated").or(`organization_id.is.null,organization_id.eq.${session.organizationId}`);
  }
  const onboarding = await getClientOnboardingProfile(session.organizationId).catch(() => null);
  const selectedIndustry = await getClientWorkspaceIndustry(session.organizationId,onboarding);
  if (getIndustryExperience(selectedIndustry).slug === "hotels") return <HotelOverviewPage/>;
  const [summary, wallet, subscriptionResult, whatsappStatus, latestEvaluation] = await Promise.all([
    getClientPortalSummary(session.organizationId),
    getFluxWalletSummary(session.organizationId).catch(() => null),
    getActiveFluxSubscription(session.organizationId).then((value) => ({ value, unavailable: false })).catch(() => ({ value: null, unavailable: true })),
    (async (): Promise<WhatsAppStatus | null> => {
      try {
        const [{ data: binding }, { data: integration }] = await Promise.all([
          admin.from("whatsapp_twilio_bindings").select("status,sender_phone_e164").eq("organization_id", session.organizationId).maybeSingle(),
          admin.from("organization_integrations").select("provider,status").eq("organization_id", session.organizationId).in("provider", ["whatsapp", "whatsapp_business"]).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        ]);
        return { status: binding?.status === "connected" || integration?.status === "connected" ? "connected" : binding?.status || integration?.status || null, sender_phone_e164: binding?.sender_phone_e164 || null };
      } catch { return null; }
    })(),
    (async () => { try { const { data } = await admin.from("ai_business_evaluation_sessions").select("id,status,context,evaluation,created_at,updated_at").eq("organization_id",session.organizationId).eq("status","evaluated").order("updated_at",{ascending:false}).limit(1).maybeSingle(); return data; } catch { return null; } })(),
  ]);
  const subscription = subscriptionResult.value;
  const subscriptionUnavailable = subscriptionResult.unavailable;

  const businessName = summary.onboarding?.business_name || session.organizationSlug;
  const experience = getIndustryExperience(selectedIndustry || summary.onboarding?.industry);
  if (experience.slug === "hotels") return <HotelOverviewPage/>;
  if (experience.name.toLowerCase().includes("real estate") || experience.name.toLowerCase().includes("realty")) {
    const [properties, leads, appointments] = await Promise.all([
      getProperties(100, session.organizationId).catch(() => []),
      getCampaignAudienceLeads(session.organizationId, 250).catch(() => []),
      (async () => {
        const { data } = await admin.from("appointments").select("id,title,start_at,status,customer_name,location").eq("organization_id", session.organizationId).order("start_at", { ascending: true }).limit(50);
        return (data || []) as Array<{ id: string; title: string; start_at: string | null; status: string; customer_name: string | null; location: string | null }>;
      })().catch(() => []),
    ]);
    return <OrganizationDashboard data={{
      businessName,
      industryName: experience.name,
      description: experience.dashboardDescription,
      planCode: wallet?.planCode || null,
      fluxCredits: wallet?.balance ?? null,
      fluxCreditPercentUsed: wallet?.percentUsed ?? 0,
      properties,
      leads,
      appointments,
      agents: summary.agents,
      workflows: summary.workflows,
      runs: summary.runs,
      whatsappConnected: whatsappStatus?.status === "connected",
    }} />;
  }
  if (experience.slug === "photography-studio") {
    const [customers, bookings, bookingMetadata, catalogueCategories, catalogueItems] = await Promise.all([
      admin.from("crm_customers").select("id,full_name,phone,email,status,metadata").eq("organization_id", session.organizationId).order("updated_at", { ascending: false }).limit(250),
      admin.from("appointments").select("id,title,start_at,status,customer_name,location").eq("organization_id", session.organizationId).order("start_at", { ascending: true }).limit(75),
      (async () => { try { return await admin.from("photography_booking_metadata").select("appointment_id,assigned_photographer_id,deposit_status,delivery_status").eq("organization_id", session.organizationId).limit(75) as { data: XposureBookingMetadataRow[] | null }; } catch { return { data: null as XposureBookingMetadataRow[] | null }; } })(),
      (async () => { try { return await admin.from("photography_catalogue_categories").select("id,name,cover_image_url,display_order").eq("organization_id", session.organizationId).eq("status", "active").order("display_order", { ascending: true }) as { data: XposureCategoryRow[] | null }; } catch { return { data: null as XposureCategoryRow[] | null }; } })(),
      (async () => { try { return await admin.from("photography_catalogue_items").select("category_id").eq("organization_id", session.organizationId).eq("status", "active") as { data: XposureItemRow[] | null }; } catch { return { data: null as XposureItemRow[] | null }; } })(),
    ]);
    const bookingMetadataById = new Map((bookingMetadata.data || []).map((item) => [String(item.appointment_id), item]));
    const categoryCounts = new Map<string, number>();
    for (const item of catalogueItems.data || []) categoryCounts.set(String(item.category_id), (categoryCounts.get(String(item.category_id)) || 0) + 1);
    const fallbackCategories = [["Portraits", "/exposure/portraits.jpg"], ["Weddings", "/exposure/weddings.jpg"], ["Maternity", "/exposure/maternity.jpg"], ["Birthdays", "/exposure/birthdays.jpg"], ["Family", "/exposure/family.jpg"], ["Creative sets", "/exposure/creative-sets.jpg"]] as const;
    const exposureCategories = (catalogueCategories.data || []).map((category) => ({ name: String(category.name), image: String(category.cover_image_url || "/exposure/creative-sets.jpg"), itemCount: categoryCounts.get(String(category.id)) || 0 }));
    return <PhotographyDashboard data={{
      businessName,
      planCode: wallet?.planCode || null,
      fluxCredits: wallet?.balance ?? null,
      fluxCreditPercentUsed: wallet?.percentUsed ?? 0,
      whatsappConnected: whatsappStatus?.status === "connected",
      customers: (customers.data || [] as XposureCustomerRow[]).map((customer) => ({
        id: String(customer.id),
        full_name: String(customer.full_name || "Unnamed client"),
        phone: customer.phone ? String(customer.phone) : null,
        email: customer.email ? String(customer.email) : null,
        status: customer.status ? String(customer.status) : null,
        metadata: customer.metadata && typeof customer.metadata === "object" ? customer.metadata as Record<string, unknown> : null,
      })),
      bookings: (bookings.data || [] as XposureBookingRow[]).map((booking) => ({
        id: String(booking.id),
        title: String(booking.title || "Studio session"),
        start_at: booking.start_at ? String(booking.start_at) : null,
        status: String(booking.status || "pending"),
        customer_name: booking.customer_name ? String(booking.customer_name) : null,
        location: booking.location ? String(booking.location) : null,
        assigned_photographer_id: bookingMetadataById.get(String(booking.id))?.assigned_photographer_id || null,
        deposit_status: bookingMetadataById.get(String(booking.id))?.deposit_status || null,
        delivery_status: bookingMetadataById.get(String(booking.id))?.delivery_status || null,
        metadataLoaded: bookingMetadataById.has(String(booking.id)),
      })),
      agents: summary.agents,
      workflows: summary.workflows,
      runs: summary.runs,
      catalogueCategories: exposureCategories.length ? exposureCategories : fallbackCategories.map(([name, image]) => ({ name, image, itemCount: 0 })),
    }} />;
  }

  const activeAgents = summary.agents.filter((agent: PortalAgent) => ["published", "testing"].includes(agent.status)).length;
  const activeWorkflows = summary.workflows.filter((workflow: PortalWorkflow) => workflow.status === "active").length;
  const successfulRuns = summary.runs.filter((run: PortalWorkflowRun) => run.status === "succeeded").length;
  const failedRuns = summary.runs.filter((run) => ["failed", "timed_out", "cancelled", "error"].includes(run.status.toLowerCase()));
  const attentionAgents = summary.agents.filter((agent) => ["error", "disabled", "paused"].includes(agent.status.toLowerCase()));
  const trialDays = trialDaysRemaining(wallet?.trialEndsAt || null);
  const isTrial = Boolean(wallet && (wallet.trialEndsAt !== null || wallet.trialCreditLimit !== null));
  const { data: organization } = await admin.from("organizations").select("metadata").eq("id", session.organizationId).maybeSingle();
  const organizationMetadata = organization?.metadata && typeof organization.metadata === "object"
    ? organization.metadata as Record<string, unknown>
    : {};
  const workspaceMode = String(organizationMetadata.workspace_mode || "");
  const isFreeWorkspace = workspaceMode === "free" && !subscription && !isTrial && !subscriptionUnavailable;
  const capabilities = await getPortalCapabilities(session).catch(() => null);
  const health = getWorkspaceHealth(summary, !capabilities || capabilities.systemsUnavailable);
  const systemHealthy = health.state === "observed";
  const recentActivity = summary.runs.slice(0, 6);
  const unavailableSources = summary.unavailableSources || [];
  const modules = getWorkspaceModules({ experience, capabilities, preview: session.isAdminPreview, planCode: wallet?.planCode, trial: isTrial });

  return (
    <main className={`portal-page portal-command-center ${workspaceStyles.overview}`}>
      <section className="portal-command-hero">
        <div>
          <p className="portal-kicker">Business command center · {experience.name}</p>
          <h1>Welcome back, {businessName}.</h1>
          <p>{experience.dashboardDescription} See what your AI team is handling, what needs your attention, and how your business systems are performing.</p>
        </div>
        <div className={`portal-health-pill ${systemHealthy ? "healthy" : "attention"}`}>
          <span />
          <div>
            <small>System status</small>
            <strong>{health.label}</strong>
          </div>
        </div>
      </section>

      {health.state === "unavailable" ? <section className="portal-card" role="alert"><h2>Some workspace information is unavailable</h2><p>Reload before relying on setup status, counts or recent activity. A failed request does not mean there are no records.</p><a className="portal-button secondary" href="/portal">Reload overview</a></section> : null}

      {isFreeWorkspace ? (
        <section className="portal-card portal-activation-banner" aria-label="Choose a Fluxknight plan">
          <div>
            <p className="portal-kicker">Free workspace</p>
            <h2>Your workspace is ready. Activate it when you are ready.</h2>
            <p>Explore your dashboard and complete your business setup without paying or starting a trial. Choose a paid plan or activate the Basic free trial when you want customer-facing AI turned on.</p>
          </div>
          {capabilities?.isOwner && !session.isAdminPreview ? <div className="portal-actions">
            <Link className="portal-button secondary" href="/pricing">Choose a plan</Link>
            <TrialActivationButton />
          </div> : <p>Ask your organization owner to review activation and plan access.</p>}
        </section>
      ) : null}

      {isTrial ? (
        <section className="portal-trial-banner" aria-label="Free trial status">
          <div>
            <p className="portal-kicker">Basic free trial</p>
            <strong>{wallet?.chargeableAiPaused ? "Trial ended" : `${trialDays ?? 0} day${trialDays === 1 ? "" : "s"} remaining`}</strong>
            <small>WhatsApp AI + Web AI are included during your trial.</small>
          </div>
          <div>
            <span>Flux Credits</span>
            <strong>{wallet ? wallet.balance.toLocaleString("en-NG") : "Unavailable"} / {wallet ? (wallet.trialCreditLimit || wallet.monthlyCredits).toLocaleString("en-NG") : "Unavailable"}</strong>
            <small>Trial ends when time expires or credits reach zero.</small>
          </div>
          <Link className="portal-button" href="/pricing">Upgrade plan</Link>
        </section>
      ) : null}

      {latestEvaluation ? (() => { const ev = (latestEvaluation.evaluation || {}) as EvaluationRecord; const ctx = (latestEvaluation.context || {}) as { requirements?: EvaluationDetails }; const custom=ev.pricingType==="custom"; return <section className="portal-card" aria-label="Latest AI evaluation"><div className="portal-card-head"><div><p className="portal-kicker">Business AI evaluation</p><h2>Your latest evaluation</h2><p>{ev.summary || "Your Fluxknight evaluation has been saved to this workspace."}</p></div><span className="portal-health-pill healthy"><span /><div><small>Opportunity</small><strong>{typeof ev.score==="number"?`${ev.score}/100`:String(ev.opportunity||"Evaluated")}</strong></div></span></div><div className="portal-business-metrics"><article className="portal-business-metric"><span>Recommended system</span><strong>{ev.recommendedSystem || "Pending"}</strong></article><article className="portal-business-metric"><span>Recommendation</span><strong>{custom ? "Custom" : String(ev.recommendedPlan || "Standard")}</strong></article><article className="portal-business-metric"><span>Requirements</span><strong>{ctx.requirements?.specificity === "custom" ? "Custom requested" : ctx.requirements?.specificity === "specific" ? "Specific workflow" : "Recommendation-led"}</strong></article></div>{ctx.requirements?.details ? <div className="portal-clear-state"><span><Workflow size={19}/></span><div><strong>What you want Fluxknight to do</strong><p>{String(ctx.requirements.details)}</p></div></div> : null}</section>; })() : null}

      {summary.onboarding?.status === "submitted" && whatsappStatus?.status !== "connected" ? (
        <section className="portal-card portal-activation-banner" aria-label="WhatsApp setup">
          <div>
            <p className="portal-kicker">Next step</p>
            <h2>Your AI setup brief is with Fluxknight.</h2>
            <p>While our team prepares your AI agent, connect the WhatsApp Business number you want to use during your trial.</p>
          </div>
          <Link className="portal-button" href="/portal/integrations">Connect WhatsApp</Link>
        </section>
      ) : null}

      <section className="portal-business-metrics" aria-label="Business system overview">
        <article className="portal-business-metric">
          <span><Bot size={17} /> AI team</span>
          <strong>{unavailableSources.includes("agents") ? "Unavailable" : activeAgents}</strong>
          <small>{unavailableSources.includes("agents") ? "Agent information could not be loaded" : `${summary.agents.length} total agent${summary.agents.length === 1 ? "" : "s"}`}</small>
        </article>
        <article className="portal-business-metric">
          <span><Workflow size={17} /> Automations</span>
          <strong>{unavailableSources.includes("workflows") ? "Unavailable" : activeWorkflows}</strong>
          <small>{unavailableSources.includes("workflows") ? "System information could not be loaded" : `${summary.workflows.length} configured`}</small>
        </article>
        <article className="portal-business-metric">
          <span><Activity size={17} /> Recent activity</span>
          <strong>{unavailableSources.includes("runs") ? "Unavailable" : summary.runs.length}</strong>
          <small>{unavailableSources.includes("runs") ? "Activity could not be loaded" : `${successfulRuns} completed successfully`}</small>
        </article>
        <article className="portal-business-metric">
          <span><Clock3 size={17} /> Flux Credits</span>
          <strong>{wallet ? wallet.balance.toLocaleString("en-NG") : "Unavailable"}</strong>
          <small>{wallet ? `${wallet.percentUsed}% used this cycle` : "Usage could not be loaded"}</small>
        </article>
      </section>

      <WorkspacePresetPanel experience={experience} modules={modules} unavailable={!capabilities} preview={session.isAdminPreview} />

      <section className="portal-page">
        <article className="portal-card portal-attention-card">
          <div className="portal-card-head">
            <div>
              <p className="portal-kicker">Needs your attention</p>
              <h2>{systemHealthy ? "Nothing urgent recorded" : health.label}</h2>
              <p>Important items that could affect your AI team or customer experience.</p>
            </div>
            {systemHealthy ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}
          </div>

          <div className="portal-list">
            {health.state === "unavailable" || health.state === "setup" ? <p>{health.description}</p> : null}
            {failedRuns.slice(0, 3).map((run: PortalWorkflowRun) => (
              <Link className="portal-list-row portal-list-link" href="/portal/systems" key={run.id}>
                <div>
                  <strong>{friendlyWorkflowName(run.workflow_key)}</strong>
                  <span>An automation needs review · {formatDate(run.created_at)}</span>
                </div>
                <em>Review</em>
              </Link>
            ))}
            {attentionAgents.slice(0, 2).map((agent: PortalAgent) => (
              <Link className="portal-list-row portal-list-link" href="/portal/agents" key={agent.id}>
                <div>
                  <strong>{agent.name}</strong>
                  <span>This AI agent is currently {agent.status.replaceAll("_", " ")}.</span>
                </div>
                <em>Open</em>
              </Link>
            ))}
            {systemHealthy ? (
              <div className="portal-clear-state">
                <span><ShieldCheck size={19} /></span>
                <div>
                  <strong>No recent issues recorded</strong>
                  <p>{health.description}</p>
                </div>
              </div>
            ) : null}
          </div>
        </article>

      </section>

      <section className="portal-card portal-ai-team-preview">
        <div className="portal-card-head">
          <div>
            <p className="portal-kicker">AI workforce</p>
            <h2>Your AI Team</h2>
            <p>See the systems working for your business and their current status.</p>
          </div>
          {!session.isAdminPreview && capabilities?.systems ? <Link href="/portal/agents">View all agents <ChevronRight size={14} /></Link> : null}
        </div>
        <div className="portal-ai-team-grid">
          {summary.agents.slice(0, 3).map((agent: PortalAgent) => {
            const content = <>
              <span className="portal-agent-icon"><Bot size={20} /></span>
              <div>
                <div className="portal-ai-team-title">
                  <strong>{agent.name}</strong>
                  <em className={["published", "testing", "active"].includes(agent.status.toLowerCase()) ? "live" : "attention"}><i />{agent.status.replaceAll("_", " ")}</em>
                </div>
                <p>{agent.description || "AI agent configured for your business."}</p>
              </div>
              <ChevronRight size={17} />
            </>;
            return !session.isAdminPreview && capabilities?.systems
              ? <Link href="/portal/agents" className="portal-ai-team-card" key={agent.id}>{content}</Link>
              : <article className="portal-ai-team-card" key={agent.id}>{content}</article>;
          })}
          {!summary.agents.length ? <p className="portal-empty">{unavailableSources.includes("agents") ? "Agent information is unavailable. Reload to try again." : "Your AI agents will appear here once provisioning begins."}</p> : null}
        </div>
      </section>

      <section className="portal-card">
        <div className="portal-card-head">
          <div>
            <p className="portal-kicker">Business activity</p>
            <h2>What your systems have been doing</h2>
            <p>A simple view of recent automation activity in your workspace.</p>
          </div>
          {!session.isAdminPreview && capabilities?.systems ? <Link href="/portal/systems">View automations <ChevronRight size={14} /></Link> : null}
        </div>
        <div className="portal-list">
          {recentActivity.map((run) => (
            <div className="portal-list-row" key={run.id}>
              <div>
                <strong>{friendlyWorkflowName(run.workflow_key)}</strong>
                <span>{formatDate(run.created_at)}{run.duration_ms ? ` · ${run.duration_ms} ms` : ""}</span>
              </div>
              <em>{run.status.replaceAll("_", " ")}</em>
            </div>
          ))}
          {!recentActivity.length ? <p className="portal-empty">{unavailableSources.includes("runs") ? "Recent activity is unavailable. Reload to try again." : "No recent business-system activity has been recorded yet."}</p> : null}
        </div>
      </section>

      {wallet ? <details className={workspaceStyles.planDisclosure}><summary>Plan access details</summary><PlanEntitlementsPanel planCode={wallet.planCode} /></details> : (
        <section className="portal-card portal-degraded-state" aria-live="polite">
          <div className="portal-card-head">
            <div><p className="portal-kicker">Plan & usage</p><h2>Usage data temporarily unavailable</h2><p>Your workspace remains available while billing and credit data reconnects.</p></div>
            <AlertTriangle size={19} />
          </div>
          {!session.isAdminPreview && capabilities?.billing ? <Link className="portal-button secondary" href="/portal/billing">Open Plan & Usage</Link> : null}
        </section>
      )}
    </main>
  );
}
