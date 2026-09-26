import SupportLifecycleAlerts from "@/components/admin/SupportLifecycleAlerts";
import AgentLeoClient from "./AgentLeoClient";
import "./support.css";
import "./leo-mobile-chat.css";

export default function SupportPage() {
  return (
    <div className="admin-page">
      <SupportLifecycleAlerts />
      <AgentLeoClient
        scopeLabel="Platform Operations & Support"
        title="Super Admin Leo"
        description="Platform-wide authorized support and operations across Fluxknight organizations. Super Admin Leo can inspect tenants globally, but consequential tenant actions must resolve an explicit organization context and remain approval-gated."
        welcomeMessage="I am Super Admin Leo. I can inspect Fluxknight platform health and authorized tenant environments, investigate escalations from Tenant Super Leo, and prepare controlled platform actions. Consequential tenant actions require an explicit organization target and the normal approval trail."
        placeholder="Ask Super Admin Leo to inspect a tenant, escalation, system failure, or platform issue..."
        typingLabel="Inspecting platform evidence"
      />
    </div>
  );
}
