import Link from "next/link";
import styles from "./XposureDashboardHome.module.css";

const modules = [
  { label: "Studio Catalogue", detail: "Manage bookable studio services and packages", href: "/dashboard/catalog", mark: "01" },
  { label: "Bookings", detail: "Appointments, schedules and customer details", href: "/dashboard/appointments", mark: "02" },
  { label: "Conversations", detail: "Customer messages and Maia handoffs", href: "/dashboard/conversations", mark: "03" },
  { label: "AI Agents", detail: "Agent status, knowledge and behaviour", href: "/dashboard/agents", mark: "04" },
  { label: "Automations", detail: "Follow-ups, reminders and workflows", href: "/dashboard/automations", mark: "05" },
  { label: "Integrations", detail: "WhatsApp, email and connected services", href: "/dashboard/integrations", mark: "06" },
];

export default function XposureDashboardHome() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>XPOSURE STUDIOS / WORKSPACE</span>
          <h1>Your studio.<br /><span>In focus.</span></h1>
          <p>Bookings, client conversations and studio operations, together in one workspace.</p>
          <div className={styles.actions}>
            <Link className={styles.primaryAction} href="/dashboard/appointments">View bookings <span aria-hidden="true">↗</span></Link>
            <Link className={styles.secondaryAction} href="/dashboard/catalog">Studio catalogue</Link>
          </div>
        </div>
        <div className={styles.heroVisual} aria-label="Xposure studio workspace overview">
          <div className={styles.orbit} />
          <div className={styles.visualLabel}>XS<span> / STUDIO OPERATIONS</span></div>
          <div className={styles.visualIndex}>01—06</div>
          <div className={styles.visualLine} />
          <div className={styles.visualNote}>CREATIVE WORK.<br />CLEAR OPERATIONS.</div>
        </div>
      </section>

      <section className={styles.statusRow} aria-label="Workspace status">
        <div><span className={styles.statusDot} /> <span>Workspace</span><strong>Active tenant</strong></div>
        <div><span>PLATFORM</span><strong>Fluxknight</strong></div>
        <div><span>AI CONCIERGE</span><strong>Maia</strong></div>
        <div><span>MODE</span><strong>Studio operations</strong></div>
      </section>

      <section className={styles.sectionHead}>
        <div><span className={styles.eyebrow}>WORKSPACE MODULES</span><h2>Everything in its place.</h2></div>
        <p>Choose a workspace to continue. Services and prices remain configurable until the official studio price list is added.</p>
      </section>

      <section className={styles.moduleGrid}>
        {modules.map((module) => (
          <Link href={module.href} className={styles.moduleCard} key={module.label}>
            <span className={styles.moduleNumber}>{module.mark}</span>
            <span className={styles.moduleArrow} aria-hidden="true">↗</span>
            <h3>{module.label}</h3>
            <p>{module.detail}</p>
            <span className={styles.moduleLink}>Open module <span aria-hidden="true">→</span></span>
          </Link>
        ))}
      </section>

      <section className={styles.creditPanel}>
        <div><span className={styles.eyebrow}>FLUX CREDITS</span><h2>Usage, without the guesswork.</h2><p>View credit balance, usage and transaction history from the credits workspace.</p></div>
        <Link href="/dashboard/billing" className={styles.creditLink}>View credits <span aria-hidden="true">↗</span></Link>
      </section>
    </main>
  );
}
