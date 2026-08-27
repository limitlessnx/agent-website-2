import styles from "@/components/admin/AdminDashboardLoading.module.css";

export default function DashboardLoading() {
  return (
    <main className="admin-page" aria-busy="true" aria-label="Loading dashboard">
      <section className={styles.shell}>
        <div className={styles.header}>
          <div>
            <span className={styles.lineShort} />
            <span className={styles.lineTitle} />
            <span className={styles.lineWide} />
          </div>
          <div className={styles.actions}>
            <span />
            <span />
          </div>
        </div>

        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.lineShort} />
            <span className={styles.heroTitle} />
            <span className={styles.lineWide} />
            <div className={styles.chips}><i /><i /><i /></div>
          </div>
          <div className={styles.leo}><span /></div>
        </div>

        <div className={styles.command}><span /><span /></div>

        <div className={styles.metrics}>
          {Array.from({ length: 4 }).map((_, index) => <div className={styles.metric} key={index}><span /><b /><i /></div>)}
        </div>

        <div className={styles.grid}>
          <div className={styles.panel}><span className={styles.lineShort} /><span className={styles.lineMedium} />{Array.from({ length: 4 }).map((_, index) => <i className={styles.row} key={index} />)}</div>
          <div className={styles.panel}><span className={styles.lineShort} /><span className={styles.lineMedium} />{Array.from({ length: 4 }).map((_, index) => <i className={styles.row} key={index} />)}</div>
        </div>
      </section>
    </main>
  );
}
