import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import OnboardingQueueClient from "./OnboardingQueueClient";

type Package = { id: string; name: string; slug: string; currency: string; billing_interval: string };

export const dynamic = "force-dynamic";

export default async function OnboardingQueuePage() {
  let packages: Package[] = [];
  let error = "";
  try {
    packages = await supabaseServerRequest<Package[]>("service_packages?select=id,name,slug,currency,billing_interval&status=eq.active&order=name.asc");
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Unable to load service packages.";
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Managed Delivery</p>
          <h1>Client Onboarding</h1>
          <p>Move paid customers from information collection to Super Admin review, configuration, testing, and activation.</p>
        </div>
      </div>
      {error ? <section className="admin-panel"><p className="admin-form-message">{error}</p></section> : null}
      <OnboardingQueueClient packages={packages} />
    </div>
  );
}
