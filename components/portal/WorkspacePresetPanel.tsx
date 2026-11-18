import Link from "next/link";
import { CardHeader, DashboardCard, StatusBadge } from "@/components/ui/DashboardPrimitives";
import { getIndustryWorkspacePreset, type IndustryExperience } from "@/lib/industryExperience";
import type { WorkspaceModule } from "@/lib/workspace-overview";
import styles from "./WorkspacePresetPanel.module.css";

export default function WorkspacePresetPanel({ experience, modules, unavailable, preview }: {
  experience: IndustryExperience;
  modules: WorkspaceModule[];
  unavailable: boolean;
  preview?: boolean;
}) {
  const preset = getIndustryWorkspacePreset(experience);
  return <DashboardCard className={styles.panel} aria-label={`${experience.name} workspace modules`}>
    <CardHeader title="Your business workspace" description={`${preset.title} · ${experience.dashboardDescription}`} />
    {unavailable ? <p role="alert">Workspace access could not be checked. Reload this page before relying on the available modules.</p> : null}
    {preview ? <p role="status">Read-only preview. Open an authorized workspace to use these modules.</p> : null}
    <div className={styles.modules}>
      {modules.map((module) => <article className={styles.module} key={module.key} data-workspace-module={module.key}>
        <div className={styles.moduleHeading}><h3>{module.title}</h3><StatusBadge tone={module.status === "unavailable" ? "warning" : module.status === "available" ? "neutral" : "info"}>{module.statusLabel}</StatusBadge></div>
        <p>{module.description}</p>
        {module.href ? <Link className="portal-button secondary" href={module.href}>{module.action}</Link> : null}
      </article>)}
    </div>
    {!unavailable && !modules.length ? <p>No business modules are available for your current role. Ask your organization owner to review access.</p> : null}
    <details className={styles.guide}>
      <summary>Workflow & setup guide</summary>
      <p>This is a suggested workflow for your team. Automations require their own configuration and approval.</p>
      <ol className={styles.journey}>{preset.journey.map((step) => <li key={step}>{step}</li>)}</ol>
      <h3>Information to confirm</h3>
      <ul>{preset.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul>
      {experience.workspaceSetupNote ? <p>{experience.workspaceSetupNote}</p> : null}
      <p>These setup notes do not mean a connection, booking, payment or automation has been activated.</p>
    </details>
  </DashboardCard>;
}
