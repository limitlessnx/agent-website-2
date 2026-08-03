import Link from "next/link";
import { AlertTriangle, CheckCircle2, Mail, MessageCircle, PhoneCall, Search } from "lucide-react";
import { listAutomationProvisioningJobs, listAutomationTemplateVersions, listAutomationTemplates } from "@/lib/automation-provisioning";
import { automationProjects } from "@/lib/limitless-data";
import { getWorkflowRegistrySummary } from "@/lib/workflow-registry";
import AutomationTemplateManager from "./AutomationTemplateManager";

export default async function AutomationsPage() {
  const registry = await getWorkflowRegistrySummary().catch(() => ({
    configured: false,
    workflows: [],
    runs: [],
    active: 0,
    paused: 0,
    failures: 0,
    successRate: 0,
  }));

  const needsAttention = registry.failures > 0 || !registry.configured;
  const [automationTemplates, automationVersions, automationJobs] = await Promise.all([
    listAutomationTemplates().catch(() => []),
    listAutomationTemplateVersions().catch(() => []),
    listAutomationProvisioningJobs().catch(() => []),
  ]);
  const modules = [
    { title: "Follow-up automation", detail: "Sequences, reminders and enrolled contacts", href: "/dashboard/limitless/followups", icon: MessageCircle },
    { title: "Email automation", detail: "Campaigns, templates and scheduled email actions", href: "/dashboard/workflows/email", icon: Mail },
    { title: "Outbound calling", detail: "Call campaigns, queues and appointment handoff", href: "/dashboard/workflows/calls", icon: PhoneCall },
    { title: "Lead sourcing", detail: "Prospect searches, saved lists and exports", href: "/dashboard/workflows/scraping", icon: Search },
  ];

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Fluxknight Operations</p>
          <h1>Automation Center</h1>
          <p>Manage business automations without exposing backend workflow machinery.</p>
        </div>
        <Link href="/dashboard/workflows" className={needsAttention ? "admin-status warning" : "admin-status live"}>
          {needsAttention ? "Needs attention" : "Automation healthy"}
        </Link>
      </header>

      <section className="admin-grid two">
        {modules.map((module) => (
          <Link href={module.href} key={module.title} className="admin-panel compact">
            <div className="admin-panel-header">
              <div><h2>{module.title}</h2><p>{module.detail}</p></div>
              <module.icon size={18} />
            </div>
          </Link>
        ))}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Organization automations</h2><p>Business-facing automation projects grouped by purpose.</p></div>
          {needsAttention ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
        </div>
        <div className="admin-list">
          {automationProjects.map((project) => (
            <div key={project.id} className="admin-list-row">
              <div>
                <strong>{project.name}</strong>
                <span>{project.channel} · {project.description}</span>
              </div>
              <em>{project.status}</em>
            </div>
          ))}
        </div>
      </section>

      <AutomationTemplateManager templates={automationTemplates} versions={automationVersions} jobs={automationJobs} />
    </main>
  );
}
