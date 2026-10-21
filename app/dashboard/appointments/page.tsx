import Link from "next/link";
import styles from "../catalog/studio.module.css";

export default function StudioBookingsPage() {
  return <main className={styles.page}>
    <Link href="/dashboard" className={styles.back}>← Workspace overview</Link>
    <header className={styles.header}><div><span className={styles.eyebrow}>XPOSURE STUDIOS / SCHEDULING</span><h1>Bookings</h1><p>A dedicated workspace for studio enquiries, confirmed sessions, schedules and client details.</p></div><span className={styles.pill}>Backend pending</span></header>
    <section className={styles.stats}><article><span>UPCOMING</span><strong>—</strong><small>Awaiting live booking data</small></article><article><span>AWAITING CONFIRMATION</span><strong>—</strong><small>Awaiting live booking data</small></article><article><span>COMPLETED</span><strong>—</strong><small>Awaiting live booking data</small></article></section>
    <section className={styles.empty}><div className={styles.emptyMark}>XS</div><h2>Bookings will appear here</h2><p>This screen is a UI foundation only. It does not create appointments or display fabricated customer records. The next step is to connect it to Xposure’s tenant-scoped booking source.</p><Link href="/dashboard/conversations" className={styles.action}>View conversations ↗</Link></section>
  </main>;
}