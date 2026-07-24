import { Bot, Building2, Clock3, Mail, Users } from "lucide-react";
import { listClientOnboardingProfiles, type ClientOnboardingProfile } from "@/lib/client-workspace-onboarding";
import ClientStatusControl from "./ClientStatusControl";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  let profiles: ClientOnboardingProfile[] = [];
  let error = "";
  try {
    profiles = await listClientOnboardingProfiles(100);
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
          <h1>Client onboarding</h1>
          <p>Move every organization from account creation through configuration, testing, approval, and launch.</p>
        </div>
      </div>

      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p><Users size={15} /> Client accounts</p><strong>{profiles.length}</strong><span>Visible organizations</span></article>
        <article className="admin-metric-card"><p><Clock3 size={15} /> In progress</p><strong>{inProgress}</strong><span>Still completing onboarding</span></article>
        <article className="admin-metric-card"><p><Bot size={15} /> Configured</p><strong>{configured}</strong><span>{testing} testing or approving</span></article>
        <article className="admin-metric-card"><p><Building2 size={15} /> Live</p><strong>{live}</strong><span>Client systems launched</span></article>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Workspace queue</h2><p>Update the deployment stage directly from the queue.</p></div>
        </div>
        {error ? <p className="admin-empty">{error}</p> : null}
        <div className="admin-list">
          {profiles.map((profile) => (
            <div key={profile.id} className="admin-list-row">
              <div>
                <strong>{profile.business_name || "Unnamed organization"}</strong>
                <span><Mail size={13} /> {profile.business_email || "No business email"} · {profile.industry || "Industry not selected"}</span>
                <span>{profile.requested_agents.length ? profile.requested_agents.join(", ").replaceAll("_", " ") : "No agents selected yet"}</span>
                <span>Created {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(profile.created_at))}</span>
              </div>
              {profile.status === "in_progress" ? <em className="muted">Client completing form</em> : <ClientStatusControl id={profile.id} value={profile.status} />}
            </div>
          ))}
          {!profiles.length && !error ? <p className="admin-empty">No client onboarding records exist yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
