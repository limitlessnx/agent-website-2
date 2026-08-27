import styles from "@/components/admin/AdminDashboardLoading.module.css";

export default function DashboardLoading() {
  return (
    <main className="admin-page" aria-busy="true" aria-label="Loading dashboard">
      <section className={styles.shell}>
        <div className={styles.header}>
          <div className={styles.headerCopy}>
            <span className={styles.lineShort} />
            <span className={styles.lineTitle} />
            <span className={styles.lineWide} />
          </div>
          <div className={styles.actions} aria-hidden="true">
            <span />
            <span />
          </div>
        </div>

        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.lineShort} />
            <span className={styles.heroTitle} />
            <span className={styles.lineWide} />
            <div className={styles.chips} aria-hidden="true"><i /><i /><i /></div>
          </div>
          <div className={styles.leo} aria-hidden="true"><span /></div>
        </div>

        <div className={styles.command} aria-hidden="true"><span /><span /></div>

        <div className={styles.metrics} aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className={styles.metric} key={index}><span /><b /><i /></div>
          ))}
        </div>

        <div className={styles.grid} aria-hidden="true">
          {Array.from({ length: 2 }).map((_, panelIndex) => (
            <div className={styles.panel} key={panelIndex}>
              <span className={styles.lineShort} />
              <span className={styles.lineMedium} />
              {Array.from({ length: 4 }).map((_, rowIndex) => <i className={styles.row} key={rowIndex} />)}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
