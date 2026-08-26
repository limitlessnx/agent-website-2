import { getLeads, getN8nStatus, getSupabaseReadiness } from "@/lib/limitless-data";
import { listClientOnboardingProfiles } from "@/lib/client-workspace-onboarding";
import LeoOverview from "@/components/admin/LeoOverview";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [leads, clients, automationStatus, supabase] = await Promise.all([
    getLeads(500).catch(() => []),
    listClientOnboardingProfiles(100).catch(() => []),
    getN8nStatus().catch(() => ({ error: "Unavailable" })),
    getSupabaseReadiness().catch(() => ({ ready: false })),
  ]);

  const newLeads = leads.filter((lead) => String(lead.status || "").toLowerCase() === "new");
  const pendingClients = clients.filter((client) => !["live", "paused"].includes(client.status));
  const liveClients = clients.filter((client) => client.status === "live");
  const systemHealth = supabase.ready && !automationStatus.error ? "Operational" : "Attention";
  const notifications = [
    ...newLeads.slice(0, 3).map((lead) => ({ title: "New Limitless Realty lead", detail: lead.name || lead.phone || "A new lead entered the CRM", href: "/dashboard/limitless/leads", type: "organization" })),
    ...pendingClients.slice(0, 3).map((client) => ({ title: "Client workspace needs attention", detail: client.business_name || client.business_email || "Client organization requires review", href: "/dashboard/clients", type: "platform" })),
  ].slice(0, 6);

  return (
    <main className="admin-page">
      <LeoOverview
        newLeads={newLeads.length}
        clients={clients.map((client) => ({ id: client.id, business_name: client.business_name, business_email: client.business_email, status: client.status }))}
        liveClients={liveClients.length}
        pendingClients={pendingClients.length}
        attentionCount={notifications.length}
        systemHealth={systemHealth}
        notifications={notifications}
      />
    </main>
  );
}
