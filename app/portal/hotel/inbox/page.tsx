import Link from "next/link";
import { redirect } from "next/navigation";
import { hotelActivityAccess, hotelActivityPage, hotelActivityTimezone, loadHotelInbox } from "@/lib/hotel-client-activity";
import { HotelWorkspaceError } from "@/lib/hotel-booking-service";
import styles from "@/components/portal/hotel/HotelActivity.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Maia guest conversations | Fluxknight" };
export default async function HotelInboxPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  let view;
  try {
    const session = await hotelActivityAccess("inbox"), query = await searchParams;
    const page = hotelActivityPage(query.page), q = String(query.q || ""), status = String(query.status || "");
    const [data, timeZone] = await Promise.all([loadHotelInbox(session.organizationId, q, status, page), hotelActivityTimezone(session.organizationId)]);
    view = {page,q,status,data,timeZone};
  } catch (error) { if (error instanceof HotelWorkspaceError && error.status === 401) redirect("/account/login"); return <main className={styles.page}><h1>Guest conversations unavailable</h1><p className={styles.error}>{error instanceof HotelWorkspaceError ? error.message : "Try again or ask your administrator to check access."}</p></main>; }
  const {page,q,status,data,timeZone} = view;
    const href = (next: number) => `/portal/hotel/inbox?${new URLSearchParams({ q, status, page: String(next) })}`;
    return <main className={styles.page}><header className={styles.header}><div><h1>Maia guest conversations</h1><p>Find a guest, read their message history, and see the recorded conversation state. Messages appear here when your hotel’s channels are connected.</p></div><nav className={styles.nav}><Link href="/portal/campaigns">Marketing</Link><Link href="/portal/hotel/followups">Follow-ups &amp; reminders</Link><Link href="/portal/hotel/setup">Messaging setup</Link></nav></header>
      <form className={styles.filters}><label>Guest name<input name="q" maxLength={120} defaultValue={q} placeholder="Search guests by name" /></label><label>Conversation state<select name="status" defaultValue={status}><option value="">All states</option>{["open", "ai_active", "human_active", "waiting", "closed", "resolved"].map(value => <option key={value}>{value}</option>)}</select></label><button type="submit">Search conversations</button></form>
      <p className={styles.definition}>{data.total} matching conversations · refreshed on page load. Message and unread counts are not inferred.</p>
      <section className={styles.panel} aria-label="Guest conversation list">{data.rows.map(row => <Link className={styles.row} href={`/portal/hotel/inbox/${row.id}`} key={row.id}><span className={styles.initial} aria-hidden="true">{row.guest_name.slice(0, 2).toUpperCase()}</span><div className={styles.rowBody}><strong>{row.guest_name}</strong><p>{row.preview || "Open the conversation to read its history."}</p><small>{row.channel} · {row.status.replaceAll("_", " ")}{row.ai_mode ? ` · AI mode: ${row.ai_mode.replaceAll("_", " ")}` : ""}</small></div><time>{new Intl.DateTimeFormat("en", { timeZone, dateStyle: "short", timeStyle: "short" }).format(new Date(row.updated_at))}</time></Link>)}{!data.rows.length ? <p>No matching conversations on this page.</p> : null}</section>
      <nav className={styles.pager} aria-label="Conversation pages">{page > 0 ? <Link href={href(page - 1)}>Previous</Link> : <span />}<span>Page {page + 1}</span>{(page + 1) * 25 < data.total ? <Link href={href(page + 1)}>Next</Link> : <span />}</nav>
    </main>;

}