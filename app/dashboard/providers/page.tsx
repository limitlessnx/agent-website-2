import { BrainCircuit, Mic2, ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Provider = {
  id: string;
  display_name: string;
  provider_key: string;
  provider_type: "ai" | "voice";
  status: string;
  credential_reference: string | null;
  health: Record<string, unknown>;
};

export default async function ProviderControlPage() {
  const supabase = createAdminClient();
  const [{ data: providers, error: providerError }, { count: assignmentCount, error: assignmentError }] = await Promise.all([
    supabase.from("platform_provider_catalog").select("id,display_name,provider_key,provider_type,status,credential_reference,health").order("provider_type").order("display_name"),
    supabase.from("agent_provider_assignments").select("id", { count: "exact", head: true }),
  ]);
  if (providerError) throw providerError;
  if (assignmentError) throw assignmentError;

  const rows = (providers || []) as Provider[];
  const aiProviders = rows.filter((provider) => provider.provider_type === "ai");
  const voiceProviders = rows.filter((provider) => provider.provider_type === "voice");

  function providerList(title: string, providersForType: Provider[], icon: React.ReactNode) {
    return (
      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>{title}</h2><p>Platform infrastructure. Hidden from client workspaces.</p></div>{icon}</div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Provider</th><th>Status</th><th>Credentials</th><th>Health</th></tr></thead><tbody>
          {providersForType.map((provider) => <tr key={provider.id}><td><strong>{provider.display_name}</strong><small>{provider.provider_key}</small></td><td>{provider.status}</td><td>{provider.credential_reference ? "Stored securely" : "Not connected"}</td><td>{String(provider.health?.status || "Not checked")}</td></tr>)}
        </tbody></table></div>
      </section>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-page-header"><div><p className="admin-kicker">Platform infrastructure</p><h1>AI & Voice Providers</h1><p>Manage provider availability, secure credential references, health and internal agent routing. Clients see capabilities, never vendors.</p></div><ShieldCheck size={22} /></header>
      <section className="admin-stats-grid"><article><span>AI providers</span><strong>{aiProviders.length}</strong></article><article><span>Voice providers</span><strong>{voiceProviders.length}</strong></article><article><span>Agent assignments</span><strong>{assignmentCount || 0}</strong></article></section>
      {providerList("AI providers", aiProviders, <BrainCircuit size={20} />)}
      {providerList("Voice providers", voiceProviders, <Mic2 size={20} />)}
    </main>
  );
}
