import AgentLeoClient from "@/app/dashboard/support/AgentLeoClient";
import "@/app/dashboard/support/support.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Support Agent | Fluxknight" };

export default function PortalSupportPage() {
  return (
    <main className="portal-page">
      <AgentLeoClient
        apiBase="/api/support/leo"
        scopeLabel="Tenant Support"
        title="Support Agent"
        description="Ask for help navigating your workspace, understanding your automation setup, or diagnosing tenant-specific workflow and integration issues."
        welcomeMessage="I am your Fluxknight tenant support agent. I can help you navigate this dashboard, explain your setup, check your tenant workflow status, and record support actions for admin review. I can only see this tenant workspace."
        placeholder="Ask about your dashboard, agents, workflows, integrations, errors, or account setup..."
        typingLabel="Inspecting this tenant workspace only"
      />
    </main>
  );
}
