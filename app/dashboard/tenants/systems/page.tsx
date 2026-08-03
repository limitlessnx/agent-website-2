import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import TenantSystemProvisioningClient from "./TenantSystemProvisioningClient";

export const dynamic = "force-dynamic";

type Installation = {
  id: string;
  status: string;
  requested_at: string;
  activated_at?: string | null;
  last_error?: string | null;
  organizations: { name?: string; slug?: string } | { name?: string; slug?: string }[] | null;
  system_catalog: { name?: string; slug?: string; category?: string } | { name?: string; slug?: string; category?: string }[] | null;
};

export default async function TenantSystemsPage() {
  const installations = await supabaseServerRequest<Installation[]>(
    "organization_systems?select=id,status,requested_at,activated_at,last_error,organizations(name,slug),system_catalog(name,slug,category)&order=updated_at.desc",
  ).catch(() => []);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Tenant provisioning</p>
          <h1>Client Systems</h1>
          <p>Approve marketplace selections and provision isolated organization automations from approved templates.</p>
        </div>
      </div>
      <TenantSystemProvisioningClient installations={installations} />
    </div>
  );
}
