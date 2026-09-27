import AgentLeoClient from "@/app/dashboard/support/AgentLeoClient";
import SupportLifecyclePanel from "@/components/portal/SupportLifecyclePanel";
import "@/app/dashboard/support/support.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tenant Super Leo | Fluxknight" };

export default function PortalSupportPage() {
  return (
    <main className="portal-page">
      <AgentLeoClient
        apiBase="/api/support/leo"
        scopeLabel="Tenant Operations & Support"
        title="Tenant Super Leo"
        description="Your first-line operational assistant for this organization. Super Leo can inspect permitted dashboard data, diagnose system issues, explain what is happening, prepare safe fixes, and escalate critical platform problems to Fluxknight support."
        welcomeMessage="I am your Tenant Super Leo. I am locked to this organization and your current permissions. I can investigate dashboard and system issues, explain what I find, prepare permitted actions, and escalate anything that needs platform-level attention to Fluxknight Super Admin support with the diagnostic context attached."
        placeholder="Ask Super Leo what is wrong, what needs attention, or to investigate a system..."
        typingLabel="Inspecting this organization within your permissions"
      />
      <SupportLifecyclePanel />
    </main>
  );
}
