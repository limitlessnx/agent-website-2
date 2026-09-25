import DashboardHomeExperience from "@/components/admin/DashboardHomeExperience";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { emptyOrganizationOperationalSnapshot, getOrganizationOperationalSnapshot } from "@/lib/admin-organization-data";
import { getN8nStatus, getSupabaseReadiness } from "@/lib/limitless-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const scope = await resolveAdminOrganizationScope();
  const [snapshot, automationStatus, supabase] = await Promise.all([
    getOrganizationOperationalSnapshot(scope).catch(() => emptyOrganizationOperationalSnapshot(scope.name)),
    getN8nStatus().catch(() => ({ configured: false, activeWorkflows: 0, workflows: [], error: "Unavailable" })),
    getSupabaseReadiness().catch(() => ({ configured: false, ready: false, tables: [] })),
  ]);

  const health: "Operational" | "Attention" | "Critical" =
    supabase.ready && !automationStatus.error ? "Operational" : "Attention";

  return (
    <main className="admin-page dashboard-v3-home">
      <DashboardHomeExperience
        name="Limitless"
        workspaceName={snapshot.organizationName}
        health={health}
        metrics={snapshot.metrics}
        notices={snapshot.notices}
        agents={snapshot.agents}
      />
    </main>
  );
}
