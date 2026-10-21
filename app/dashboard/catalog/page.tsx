import Link from "next/link";
import styles from "./studio.module.css";

const services = [
  { type: "PHOTOGRAPHY", name: "Portrait Session", note: "Individual portraits and personal branding", status: "Configure pricing" },
  { type: "PHOTOGRAPHY", name: "Wedding Photography", note: "Pre-wedding, ceremony and couple sessions", status: "Configure pricing" },
  { type: "STUDIO", name: "Studio Rental", note: "Bookable studio time and creative space", status: "Configure pricing" },
  { type: "CONTENT", name: "Content Creation Session", note: "Planned photo and video content for brands", status: "Configure pricing" },
];

export default function StudioCataloguePage() {
  return <main className={styles.page}>
    <Link href="/dashboard" className={styles.back}>← Workspace overview</Link>
    <header className={styles.header}><div><span className={styles.eyebrow}>XPOSURE STUDIOS / SERVICES</span><h1>Studio catalogue</h1><p>Manage the services clients can enquire about or book. Official prices are intentionally left unset until the studio price list is supplied.</p></div><span className={styles.pill}>Pricing pending</span></header>
    <section className={styles.toolbar}><div><strong>Services & packages</strong><span> · {services.length} starter service types</span></div><span className={styles.readonly}>Initial catalogue · not connected to live booking</span></section>
    <section className={styles.grid}>{services.map((service,index)=><article className={styles.card} key={service.name}><div className={styles.cardTop}><span className={styles.number}>{String(index+1).padStart(2,"0")}</span><span className={styles.type}>{service.type}</span></div><h2>{service.name}</h2><p>{service.note}</p><div className={styles.cardBottom}><span>{service.status}</span><span aria-hidden="true">↗</span></div></article>)}</section>
    <aside className={styles.note}><strong>Before publishing</strong><p>Add official package names, prices, durations, deliverables and booking terms. Nothing on this page is being offered for sale yet.</p></aside>
  </main>;
}