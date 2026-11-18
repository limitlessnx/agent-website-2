import PlatformControlCenter from "@/components/admin/PlatformControlCenter";
import { PageHeader, Button } from "@/components/ui/DashboardPrimitives";
import { getAdminControlCenter } from "@/lib/admin-control-center";
export const dynamic = "force-dynamic";
export default async function PlatformPage() {
  const data = await getAdminControlCenter().catch(() => null);
  if (!data) return <main className="admin-page"><PageHeader title="Super Admin Control Center" /><p role="alert">Platform evidence could not be loaded. No health status can be established.</p><Button href="/dashboard/platform" variant="outline">Retry evidence</Button></main>;
  return <PlatformControlCenter data={data} />;
}
