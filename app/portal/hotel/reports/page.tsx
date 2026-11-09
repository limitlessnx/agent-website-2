import Link from "next/link";
import { redirect } from "next/navigation";
import { hotelOverviewAccess, loadHotelOverview } from "@/lib/hotel-overview";
import { HotelWorkspaceError } from "@/lib/hotel-booking-service";
import { hotelTrendLabel } from "@/lib/hotel-trends-contract";
import { HotelRevenueCard } from "@/components/portal/hotel/HotelDashboardMetrics";
import styles from "@/components/portal/hotel/HotelActivity.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Hotel revenue and trends | Fluxknight" };
export default async function HotelReportsPage() {
  let view;
  try {
    const access = await hotelOverviewAccess(), data = await loadHotelOverview(access.session.organizationId, access.permissions, Boolean(access.session.isAdminPreview));
    view = {data};
  } catch (error) { if (error instanceof HotelWorkspaceError && error.status === 401) redirect("/account/login"); return <main className={styles.page}><h1>Hotel reports unavailable</h1><p className={styles.error}>Ask your administrator to check your hotel permissions, or try again.</p></main>; }
  const {data} = view;
    const daily = data.trends?.daily || [], current = daily.slice(-7), previous = daily.slice(0, 7);
    const sum = (rows: typeof daily, key: "bookings" | "checkins") => rows.reduce((total, row) => total + row[key], 0);
    return <main className={styles.page}><header className={styles.header}><div><h1>Revenue &amp; hotel trends</h1><p>{data.details?.name || "Your hotel"} · {data.timeZone}. Comparisons use the hotel’s local dates; today is a partial day.</p></div><nav className={styles.nav}><Link href="/portal">Hotel overview</Link><Link href="/portal/hotel/inbox">Guest conversations</Link></nav></header>
      {!data.trends ? <p className={styles.error}>Trend data is unavailable. Refresh or ask your administrator to check the hotel reports.</p> : <section className={styles.panel}><h2>Guest activity · last seven days</h2><p className={styles.definition}>Booking requests: {sum(current, "bookings")} · {hotelTrendLabel(sum(current, "bookings"), sum(previous, "bookings"))} vs previous seven days. Recorded check-ins: {sum(current, "checkins")} · {hotelTrendLabel(sum(current, "checkins"), sum(previous, "checkins"))}.</p><table className={styles.trendTable}><thead><tr><th>Hotel-local day</th><th>New requests</th><th>Check-ins</th></tr></thead><tbody>{current.map(row => <tr key={row.day}><td>{row.day}</td><td>{row.bookings}</td><td>{row.checkins}</td></tr>)}</tbody></table></section>}
      {data.canViewPayments ? <HotelRevenueCard trends={data.trends} expanded /> : <p className={styles.definition}>Revenue requires payment-view permission. No payment figures were loaded for this view.</p>}
      <p className={styles.definition}>Revenue verified is the sum of currently verified offline receipt records, grouped by verification date and currency. It is not profit or an accounting recognition report. Voiding a record removes it from these figures, including earlier dates. Current occupancy is a snapshot; no historical inventory percentage is invented.</p>
    </main>;

}