import Link from "next/link";
import { Bot, Building2, LineChart, Settings2, Users } from "@/components/admin/ServerIcons";
import { listClientOnboardingProfiles, type ClientOnboardingProfile } from "@/lib/client-workspace-onboarding";
import styles from "./Workspaces.module.css";

export const dynamic = "force-dynamic";

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

export default async function ClientsPage() {
  let profiles: ClientOnboardingProfile[] = [];
  let error = "";

  try {
    profiles = await listClientOnboardingProfiles(100);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Unable to load workspaces.";
  }

  const inProgress = profiles.filter((profile) => profile.status === "in_progress").length;
  const review = profiles.filter((profile) => ["testing", "awaiting_approval", "configuration", "submitted"].includes(profile.status)).length;
  const live = profiles.filter((profile) => profile.status === "live").length;

  const internal = [
    {
      href: "/dashboard",
      name: "Fluxknight",
      type: "Platform workspace",
      description: "Cross-workspace operations, intelligence, automations and governance.",
      status: "Platform",
      icon: Bot,
    },
    {
      href: "/dashboard/limitless/leads",
      name: "Limitless Realty",
      type: "Internal business workspace",
      description: "Real-estate leads, Maia operations, campaigns, properties and customer activity.",
      status: "Internal",
      icon: Building2,
    },
    {
      href: "/dashboard/gencouv",
      name: "Gencouv",
      type: "Internal business workspace",
      description: "Trading lead generation, onboarding and business operations inside Fluxknight.",
      status: "Internal",
      icon: LineChart,
    },
  ];

  return (
    <main className={`admin-page ${styles.page}`}>
      <header className={styles.hero}>
        <div>
          <p className="admin-kicker">Workspace operations</p>
          <h1>Workspaces</h1>
          <p>Fluxknight is one operating platform. Internal businesses and client organizations live here as workspaces with their own context, agents and operations.</p>
        </div>
        <span className="admin-status live">{profiles.length + 3} visible workspaces</span>
      </header>

      <section className={styles.summary} aria-label="Workspace summary">
        <article><span>Internal</span><strong>3</strong></article>
        <article><span>Client workspaces</span><strong>{profiles.length}</strong></article>
        <article><span>In setup / review</span><strong>{inProgress + review}</strong></article>
        <article><span>Live clients</span><strong>{live}</strong></article>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div><h2>Internal workspaces</h2><p>Your own businesses stay inside the same platform shell and governance model.</p></div>
        </div>
        <div className={styles.internalGrid}>
          {internal.map((workspace) => {
            const Icon = workspace.icon;
            return (
              <Link key={workspace.href} href={workspace.href} className={styles.workspaceCard}>
                <div className={styles.cardTop}>
                  <div className={styles.identity}>
                    <span className={styles.icon}><Icon size={17} /></span>
                    <div><strong>{workspace.name}</strong><small>{workspace.type}</small></div>
                  </div>
                  <span className={styles.status}>{workspace.status}</span>
                </div>
                <div className={styles.cardBottom}>
                  <span>{workspace.description}</span>
                  <strong className={styles.open}>Open</strong>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div><h2>Client workspaces</h2><p>Organizations created through onboarding appear here once a workspace record exists.</p></div>
          <Link className="admin-button secondary" href="/dashboard/onboarding#new-client">New client</Link>
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.clientList}>
          {profiles.map((profile) => (
            <div key={profile.id} className={styles.clientRow}>
              <div className={styles.clientIdentity}>
                <strong>{profile.business_name || "Unnamed organization"}</strong>
                <span>{profile.industry || "Industry not selected"} · {profile.business_email || "No business email"}</span>
              </div>
              <div className={styles.cell}>
                <strong>{statusLabel(profile.status)}</strong>
                <span>Workspace status</span>
              </div>
              <div className={styles.cell}>
                <strong>{profile.requested_agents?.length || 0} agent{profile.requested_agents?.length === 1 ? "" : "s"}</strong>
                <span>{profile.channels?.length || 0} channel{profile.channels?.length === 1 ? "" : "s"}</span>
              </div>
              <Link className={styles.rowAction} href={`/dashboard/clients/${encodeURIComponent(profile.organization_id)}/setup`}>
                <Settings2 size={14} /><span>Open workspace</span>
              </Link>
            </div>
          ))}
          {!profiles.length && !error ? <div className={styles.empty}><Users size={18} /> No client workspaces exist yet.</div> : null}
        </div>
      </section>
    </main>
  );
}
