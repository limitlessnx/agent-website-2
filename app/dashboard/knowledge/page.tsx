import { Database, FileText, ShieldCheck } from "@/components/admin/ServerIcons";
import { getPlatformEngineSummary, humanize } from "@/lib/platform-engine";
import styles from "../PlatformControl.module.css";

export const dynamic = "force-dynamic";

function isReady(status: string) {
  return ["active", "ready", "healthy", "indexed", "available"].includes(String(status || "").toLowerCase());
}

export default async function KnowledgePage() {
  const { knowledge, errors } = await getPlatformEngineSummary();
  const sourceCount = knowledge.reduce((total, item) => total + Number(item.source_count || 0), 0);
  const readyCount = knowledge.filter((item) => isReady(item.status)).length;
  const attentionCount = knowledge.length - readyCount;

  return (
    <main className={`${styles.page} admin-page knowledge-page`}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className="admin-kicker">Knowledge control</p>
          <h1>Knowledge Center</h1>
          <p>Verify the business information agents can rely on, see what is actually provisioned, and surface collection states that still need operator attention.</p>
        </div>
        <span className={`${styles.heroStatus} ${attentionCount ? styles.warn : styles.good}`}>
          <ShieldCheck size={14} /> {attentionCount ? `${attentionCount} collection${attentionCount === 1 ? "" : "s"} need review` : "Knowledge sources stable"}
        </span>
      </header>

      <section className={styles.metrics} aria-label="Knowledge summary">
        <article className={styles.metric}><span className={styles.metricLabel}><Database size={14} /> Collections</span><strong>{knowledge.length}</strong><small>Organization knowledge containers</small></article>
        <article className={styles.metric}><span className={styles.metricLabel}><FileText size={14} /> Sources</span><strong>{sourceCount}</strong><small>Registered source records</small></article>
        <article className={styles.metric}><span className={styles.metricLabel}><ShieldCheck size={14} /> Ready</span><strong>{readyCount}</strong><small>Collections reporting an operational state</small></article>
        <article className={styles.metric}><span className={styles.metricLabel}><Database size={14} /> Review</span><strong>{attentionCount}</strong><small>Non-ready collections to inspect</small></article>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div><h2>Knowledge collections</h2><p>Properties, FAQs, pricing, policies and operating guides stay organization-scoped. Status is shown exactly as reported by the platform engine.</p></div>
          <Database size={18} />
        </div>
        <div className={styles.list}>
          {knowledge.map((item) => {
            const ready = isReady(item.status);
            return (
              <div className={styles.row} key={item.id}>
                <div className={styles.rowMain}>
                  <strong>{item.name}</strong>
                  <span>{item.description || "No description has been recorded for this collection."}</span>
                  <small>{item.source_count} {Number(item.source_count) === 1 ? "source" : "sources"} registered</small>
                </div>
                <em className={`${styles.status} ${ready ? styles.good : styles.warn}`}>{humanize(item.status)}</em>
              </div>
            );
          })}
          {!knowledge.length ? <p className={styles.empty}>No knowledge collections have been provisioned yet. Fluxknight will not imply that agents have business context that does not exist.</p> : null}
        </div>
      </section>

      {errors.length ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Knowledge visibility degraded</h2><p>Some platform-engine sources could not be read. Existing collection data above remains untouched.</p></div><ShieldCheck size={17} /></div>
          <p className={styles.note}>{errors.join(" · ")}</p>
        </section>
      ) : null}
    </main>
  );
}
