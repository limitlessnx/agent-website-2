import {
  PageHeader,
  MetricCard,
  StatusBadge,
  EmptyState,
  DashboardCard,
  CardHeader,
  Button,
} from "@/components/ui/DashboardPrimitives";
import { DropdownMenu } from "@/components/ui/DashboardInteractions";
import styles from "./page.module.css";
import Link from "next/link";
import {
  Bot,
  Building2,
  Clock3,
  Mail,
  Settings2,
  Users,
} from "@/components/admin/ServerIcons";
import {
  listClientOnboardingProfiles,
  type ClientOnboardingProfile,
} from "@/lib/client-workspace-onboarding";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  let profiles: ClientOnboardingProfile[] = [];
  let error = "";

  try {
    profiles = await listClientOnboardingProfiles(100);
  } catch (cause) {
    error =
      cause instanceof Error
        ? cause.message
        : "Unable to load client onboarding records.";
  }

  const configured = profiles.filter(
    (profile) => profile.status !== "in_progress",
  ).length;
  const inProgress = profiles.filter(
    (profile) => profile.status === "in_progress",
  ).length;
  const testing = profiles.filter((profile) =>
    ["testing", "awaiting_approval"].includes(profile.status),
  ).length;
  const live = profiles.filter((profile) => profile.status === "live").length;

  return (
    <main className="admin-page dashboard-v2-page">
      <PageHeader
        kicker="Client operations"
        title="Tenant Organizations"
        description="Switch into a tenant workspace for day-to-day operations, or open setup when you need to change its configuration."
        actions={
          <Link
            className="admin-button primary-button"
            href="/dashboard/clients/create"
          >
            Create organization
          </Link>
        }
      />
      <div className="admin-metric-grid">
        <MetricCard
          label="Client accounts"
          value={profiles.length}
          detail="Visible client accounts"
          icon={Users}
        />
        <MetricCard
          label="In progress"
          value={inProgress}
          detail="Still completing onboarding"
          icon={Clock3}
        />
        <MetricCard
          label="Configured"
          value={configured}
          detail={`${testing} testing or approving`}
          icon={Bot}
        />
        <MetricCard
          label="Live"
          value={live}
          detail="Client systems launched"
          icon={Building2}
        />
      </div>

      <DashboardCard>
        <CardHeader
          title="Client workspaces"
          description="Open a client only when you need to review or manage that workspace."
        />
        {error ? (
          <p className="admin-empty" role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.list}>
          {!error && profiles.length === 0 ? (
            <EmptyState
              title="No organizations yet"
              description="Create an organization to begin its setup."
              action={
                <Link
                  className="admin-button primary-button"
                  href="/dashboard/clients/create"
                >
                  Create organization
                </Link>
              }
            />
          ) : null}
          {profiles.map((profile) => (
            <div key={profile.id} className={styles.row}>
              <div className={styles.details}>
                <strong>
                  {profile.business_name || "Unnamed organization"}
                </strong>
                <span>
                  <Mail size={13} />{" "}
                  {profile.business_email || "No business email"} ·{" "}
                  {profile.industry || "Industry not selected"}
                </span>
                <span>
                  <StatusBadge
                    tone={profile.status === "live" ? "success" : "neutral"}
                  >
                    {profile.status.replaceAll("_", " ")}
                  </StatusBadge>{" "}
                  · Created{" "}
                  {new Intl.DateTimeFormat("en-NG", {
                    dateStyle: "medium",
                  }).format(new Date(profile.created_at))}
                </span>
              </div>
              <div className={styles.actions}>
                <Button
                  href={`/dashboard/clients/${encodeURIComponent(profile.organization_id)}/manage`}
                >
                  <Settings2 size={15} /> Manage organization
                </Button>
                <Button
                  variant="outline"
                  href={`/dashboard/clients/${encodeURIComponent(profile.organization_id)}/setup`}
                >
                  <Settings2 size={15} /> Setup
                </Button>
                <DropdownMenu label="More workspace actions">
                  <Link
                    className="admin-button secondary"
                    href={`/dashboard/clients/${encodeURIComponent(profile.organization_id)}/inspect`}
                  >
                    <Building2 size={15} /> Inspect read-only
                  </Link>
                  <Link
                    prefetch={false}
                    className="admin-button secondary"
                    href={`/dashboard/preview/tenant/${encodeURIComponent(profile.organization_id)}`}
                  >
                    <Building2 size={15} /> Open tenant dashboard
                  </Link>
                  <Link
                    prefetch={false}
                    className="admin-button secondary"
                    href={`/dashboard/switch/tenant/${encodeURIComponent(profile.organization_id)}`}
                  >
                    <Building2 size={15} /> Open workspace (admin)
                  </Link>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </DashboardCard>
    </main>
  );
}
