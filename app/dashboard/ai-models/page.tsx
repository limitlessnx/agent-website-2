import Link from "next/link";
import { BrainCircuit, ShieldCheck } from "@/components/admin/ServerIcons";
import { getAiModelControlData } from "@/lib/ai-model-control";
import AiModelControl from "./AiModelControl";
import styles from "../PlatformControl.module.css";

export const dynamic = "force-dynamic";

export default async function AiModelsPage() {
  try {
    const data = await getAiModelControlData();
    const activeModels = data.models.filter((model) => model.status === "active").length;
    const assignedOrganizations = new Set(data.assignments.map((item) => item.organization_id)).size;
    const unassignedOrganizations = Math.max(0, data.organizations.length - assignedOrganizations);

    return (
      <main className={`${styles.page} admin-page`}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className="admin-kicker">Model governance</p>
            <h1>AI Model Control</h1>
            <p>Keep model availability and organization assignments under platform control without exposing provider infrastructure to customer workspaces.</p>
          </div>
          <Link className={styles.inlineLink} href="/dashboard/providers"><BrainCircuit size={14} /> Providers</Link>
        </header>

        <section className={styles.metrics} aria-label="Model governance summary">
          <article className={styles.metric}><span className={styles.metricLabel}><BrainCircuit size={14} /> Registered</span><strong>{data.models.length}</strong><small>Models known to Fluxknight</small></article>
          <article className={styles.metric}><span className={styles.metricLabel}><ShieldCheck size={14} /> Active</span><strong>{activeModels}</strong><small>Models available for new assignments</small></article>
          <article className={styles.metric}><span className={styles.metricLabel}><BrainCircuit size={14} /> Assigned</span><strong>{assignedOrganizations}</strong><small>Organizations with a model assignment</small></article>
          <article className={styles.metric}><span className={styles.metricLabel}><ShieldCheck size={14} /> Unassigned</span><strong>{unassignedOrganizations}</strong><small>Organizations requiring model review</small></article>
        </section>

        <AiModelControl {...data} />
      </main>
    );
  } catch (error) {
    return (
      <main className={`${styles.page} admin-page`}>
        <header className={styles.hero}><div className={styles.heroCopy}><p className="admin-kicker">Model governance</p><h1>AI Model Control</h1><p>Model control could not be loaded from the current platform state.</p></div><span className={`${styles.heroStatus} ${styles.warn}`}><ShieldCheck size={14} /> Unavailable</span></header>
        <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Model control unavailable</h2><p>No changes were made. Review the underlying model-control source before attempting an assignment.</p></div><ShieldCheck size={16} /></div><p className={styles.note}>{error instanceof Error ? error.message : "Unable to load model controls."}</p></section>
      </main>
    );
  }
}
