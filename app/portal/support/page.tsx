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
        title="Agent Leo"
        description="Ask for help navigating your workspace, checking your agents and automations, or understanding anything that needs attention in your account."
        welcomeMessage="I am Agent Leo, your Fluxknight support agent. I can help you navigate this workspace, explain your setup, inspect safe tenant diagnostics, and prepare support actions for admin review. I can only see this tenant workspace."
        placeholder="Ask about your dashboard, agents, automations, messages, account setup, or something that is not working..."
        typingLabel="Inspecting this tenant workspace only"
      />
    </main>
  );
}
