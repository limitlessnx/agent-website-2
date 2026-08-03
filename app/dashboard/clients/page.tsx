import Link from "next/link";
import { Bot, Building2, Clock3, Mail, Settings2, Users } from "lucide-react";
import { listClientOnboardingProfiles, type ClientOnboardingProfile } from "@/lib/client-workspace-onboarding";
import { getPlatformEngineSummary } from "@/lib/platform-engine";
import OrganizationCreationWizard from "./OrganizationCreationWizard";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  let profiles: ClientOnboardingProfile[] = [];
  let templates: Array<{ slug: string; name: string; industry: string; description: string | null }> = [];
  let error = "";

  try {
    const [onboardingProfiles, platform] = await Promise.all([
      listClientOnboardingProfiles(100),
      getPlatformEngineSummary(),
    ]);
    profiles = onboardingProfiles;
    templates = platform.templates
      .filter((template) => template.status === "active")
      .map((template) => ({
        slug: template.slug,
        name: template.name,
        industry: template.industry,
        description: template.description,
      }));
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Unable to load client onboarding records.";
  }

  const configured = profiles.filter((profile) => profile.status !== "in_progress").length;
  const inProgress = profiles.filter((profile) => profile.status === "in_progress").length;
  const testing = profiles.filter((profile) => ["testing", "awaiting_approval"].includes(profile.status)).length;
  const live = profiles.filter((profile) => profile.status === "live").length;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Client operations</p>
          <h1>Tenant workspaces</h1>
          <p>Create an organization, then manage its business template, agents, integrations, testing and launch from one setup page.</p>
        </div>
        <Link className="admin-button secondary" href="/dashboard/scale">Open Phase 14 Scale Center</Link>
      </div>

      <OrganizationCreationWizard templates={templates} />

      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p><Users size={15} /> Client accounts</p><strong>{profiles.length}</strong><span>Visible onboarding accounts</span></article>
        <article className="admin-metric-card"><p><Clock3 size={15} /> In progress</p><strong>{inProgress}</strong><span>Still completing onboarding</span></article>
        <article className="admin-metric-card"><p><Bot size={15} /> Configured</p><strong>{configured}</strong><span>{testing} testing or approving</span></article>
        <article className="admin-metric-card"><p><Building2 size={15} /> Live</p><strong>{live}</strong><span>Client systems launched</span></article>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Tenant registry</h2><p>Open one tenant setup page instead of operating template, allocation and launch controls from separate screens.</p></div>
          <span className={templates.length ? "admin-status live" : "admin-status warning"}>{templates.length} active templates</span>
        </div>
        {error ? <p className="admin-empty">{error}</p> : null}
        <div className="admin-list">
          {profiles.map((profile) => (
            <div key={profile.id} className="admin-list-row" style={{ alignItems: "center", gap: 18 }}>
              <div style={{ flex: 1 }}>
                <strong>{profile.business_name || "Unnamed organization"}</strong>
                <span><Mail size={13} /> {profile.business_email || "No business email"} · {profile.industry || "Industry not selected"}</span>
                <span>Status: {profile.status.replaceAll("_", " ")} · Created {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(profile.created_at))}</span>
              </div>
              <Link className="admin-button" href={`/dashboard/clients/${encodeURIComponent(profile.organization_id)}/setup`}>
                <Settings2 size={15} /> Open setup
              </Link>
            </div>
          ))}
          {!profiles.length && !error ? <p className="admin-empty">No client onboarding records exist yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
