import DashboardHomeExperience from "@/components/admin/DashboardHomeExperience";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { emptyOrganizationOperationalSnapshot, getOrganizationOperationalSnapshot } from "@/lib/admin-organization-data";
import { getSupabaseReadiness } from "@/lib/limitless-data";
import { getWorkflowRegistrySummary } from "@/lib/workflow-registry";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const scope = await resolveAdminOrganizationScope();
  const [snapshot, automationStatus, supabase] = await Promise.all([
    getOrganizationOperationalSnapshot(scope).catch(() => emptyOrganizationOperationalSnapshot(scope.name)),
    getWorkflowRegistrySummary(scope).catch(() => ({ configured: false, workflows: [], runs: [], active: 0, paused: 0, failures: 0, successRate: 0 })),
    getSupabaseReadiness().catch(() => ({ configured: false, ready: false, tables: [] })),
  ]);

  const health: "Operational" | "Attention" | "Critical" =
    supabase.ready && automationStatus.failures === 0 ? "Operational" : "Attention";

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
