import DashboardHomeExperience from "@/components/admin/DashboardHomeExperience";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { emptyOrganizationOperationalSnapshot, getOrganizationOperationalSnapshot } from "@/lib/admin-organization-data";
import { getSupabaseReadiness } from "@/lib/limitless-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRealEstateOrganizationRecord } from "@/lib/real-estate-organization";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const scope = await resolveAdminOrganizationScope();
  const [snapshot, supabase] = await Promise.all([
    getOrganizationOperationalSnapshot(scope).catch(() => emptyOrganizationOperationalSnapshot(scope.name)),
    getSupabaseReadiness().catch(() => ({ configured: false, ready: false, tables: [] })),
  ]);
  let organizationMetadata: unknown = {};
  try {
    const result = await createAdminClient().from("organizations").select("metadata").eq("id", scope.organizationId).maybeSingle();
    organizationMetadata = result.data?.metadata || {};
  } catch { /* Preserve existing dashboard access; unsupported tenants simply do not get the real-estate card. */ }
  const realEstateWorkspace = isRealEstateOrganizationRecord({ slug: scope.slug, status: scope.status, metadata: organizationMetadata });

  const health: "Operational" | "Attention" | "Critical" =
    supabase.ready ? "Operational" : "Attention";

  return (
    <main className="admin-page dashboard-v3-home">
      <DashboardHomeExperience
        name={snapshot.organizationName || "Fluxknight"}
        workspaceName={snapshot.organizationName}
        health={health}
        metrics={snapshot.metrics}
        notices={snapshot.notices}
        agents={snapshot.agents}
        activity={snapshot.activity}
        conversations={snapshot.conversations}
        xposureDashboard={scope.kind === "tenant" && scope.slug === "xposure"}
        limitlessDashboard={snapshot.limitlessDashboard}
        realEstateWorkspace={realEstateWorkspace}
      />
    </main>
  );
}
