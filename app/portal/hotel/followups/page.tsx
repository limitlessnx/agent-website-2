import Link from "next/link";
import { redirect } from "next/navigation";
import { hotelActivityAccess, hotelActivityPage, hotelActivityTimezone, loadHotelFollowupLog } from "@/lib/hotel-client-activity";
import { HotelWorkspaceError } from "@/lib/hotel-booking-service";
import styles from "@/components/portal/hotel/HotelActivity.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Hotel follow-ups and reminders | Fluxknight" };
const purposeLabels: Record<string, string> = { booking_recovery: "Booking enquiry follow-up", pre_arrival: "Pre-arrival reminder", post_stay: "After-stay follow-up" };
function statusLabel(status: string, receipt: boolean) { return status === "accepted" ? receipt ? "Accepted · delivery unconfirmed" : "Needs review · no receipt" : ({ pending: "Queued", processing: "Processing", cancelled: "Stopped", unknown: "Unknown · review before resending" } as Record<string, string>)[status] || "Needs review"; }
export default async function HotelFollowupsPage({ searchParams }: { searchParams: Promise<{ purpose?: string; status?: string; page?: string }> }) {
  let view;
  try {
    const session = await hotelActivityAccess("followups"), query = await searchParams;
    const page = hotelActivityPage(query.page), purpose = String(query.purpose || ""), status = String(query.status || "");
    const [data, timeZone] = await Promise.all([loadHotelFollowupLog(session.organizationId, purpose, status, page), hotelActivityTimezone(session.organizationId)]);
    view = {page,purpose,status,data,timeZone};
  } catch (error) { if (error instanceof HotelWorkspaceError && error.status === 401) redirect("/account/login"); return <main className={styles.page}><h1>Reminder tracking unavailable</h1><p className={styles.error}>{error instanceof HotelWorkspaceError ? error.message : "Try again or ask your administrator to check access."}</p></main>; }
  const {page,purpose,status,data,timeZone} = view;
    const href = (next: number) => `/portal/hotel/followups?${new URLSearchParams({ purpose, status, page: String(next) })}`;
    return <main className={styles.page}><header className={styles.header}><div><h1>Follow-ups &amp; reminders</h1><p>Track booking enquiry follow-ups, pre-arrival reminders and after-stay messages for your hotel.</p></div><nav className={styles.nav}><Link href="/portal/hotel/inbox">Maia conversations</Link><Link href="/portal/campaigns">Marketing campaigns</Link><Link href="/portal/hotel">Bookings</Link></nav></header>
      <p className={styles.definition}>This is a tracking view. It does not activate an automatic schedule, send a message or retry an unknown outcome. Consent, guest replies, manager handover and changed booking state can stop a queued message.</p>
      <form className={styles.filters}><label>Message purpose<select name="purpose" defaultValue={purpose}><option value="">All purposes</option>{Object.entries(purposeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Status<select name="status" defaultValue={status}><option value="">All statuses</option>{["pending", "processing", "accepted", "cancelled", "unknown"].map(value => <option key={value}>{value}</option>)}</select></label><button type="submit">Filter records</button></form>
      <section className={styles.panel}><p className={styles.definition}>{data.total} matching records · {timeZone}</p><div className={styles.tableScroll}><table className={styles.reminders}><thead><tr><th>Guest</th><th>Purpose</th><th>Scheduled</th><th>Recorded outcome</th></tr></thead><tbody>{data.rows.map(row => <tr key={row.id}><td data-label="Guest"><strong>{row.guest_name}</strong><small><Link href={`/portal/hotel?booking=${row.booking_id}`}>View booking</Link></small></td><td data-label="Purpose">{purposeLabels[row.purpose] || "Hotel follow-up"}</td><td data-label="Scheduled">{new Intl.DateTimeFormat("en", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(row.scheduled_at))}</td><td data-label="Outcome">{statusLabel(row.status, Boolean(row.provider_message_id))}{row.stop_reason ? <small>Eligibility changed or review is required. Open the booking and conversation before taking further action.</small> : null}</td></tr>)}</tbody></table></div>{!data.rows.length ? <p>No matching follow-up records on this page.</p> : null}</section>
      <nav className={styles.pager} aria-label="Reminder pages">{page > 0 ? <Link href={href(page - 1)}>Previous</Link> : <span />}<span>Page {page + 1}</span>{(page + 1) * 50 < data.total ? <Link href={href(page + 1)}>Next</Link> : <span />}</nav>
    </main>;

}