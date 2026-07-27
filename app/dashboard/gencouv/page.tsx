import { Activity, Bot, LineChart, Users } from "lucide-react";
import MetricCard from "@/components/admin/MetricCard";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export const dynamic = "force-dynamic";

export default async function GencouvWorkspacePage() {
  const organizations = await supabaseServerRequest<any[]>("organizations?select=id,name,slug,status,metadata&slug=eq.gencouv&limit=1");
  const organization = organizations[0];

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Gencouv Workspace</p>
          <h1>Trading and Client Operations</h1>
          <p>One workspace for Gencouv acquisition, onboarding, customer communication, automation and operating oversight.</p>
        </div>
        <span className="admin-status live">{organization?.status || "active"}</span>
      </header>

      <div className="admin-metric-grid">
        <MetricCard icon={Users} tone="cyan" label="Client acquisition" value="Ready" detail="Lead and applicant operations" trend="workspace" />
        <MetricCard icon={Bot} tone="violet" label="AI operations" value="0" detail="Only published agents appear" trend="agents" />
        <MetricCard icon={Activity} tone="emerald" label="Live workflows" value="0" detail="Draft workflows are hidden" trend="automation" />
        <MetricCard icon={LineChart} tone="amber" label="Performance reporting" value="Pending" detail="Connect verified reporting sources" trend="analytics" />
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Workspace scope</h2><p>Gencouv controls remain separate from Limitless Realty data and operations.</p></div></div>
        <div className="admin-checklist">
          <span>Client acquisition and qualification</span>
          <span>Telegram onboarding and suitability screening</span>
          <span>Campaign, email and follow-up operations</span>
          <span>Trading service administration and reporting</span>
        </div>
      </section>
    </main>
  );
}
