"use client";
import { useState } from "react";
import { BedDouble, CalendarCheck, ReceiptText } from "lucide-react";

import { hotelTrendLabel, hotelSparkline, hotelTrendMoney, type HotelTrends } from "@/lib/hotel-trends-contract";
import type { HotelOverviewData } from "@/lib/hotel-overview-contract";
import styles from "./HotelDashboardMetrics.module.css";

export function HotelRevenueCard({ trends, expanded = false }: { trends: HotelTrends | null | undefined; expanded?: boolean }) {
  const [selected, setSelected] = useState("");
  const currencies = trends?.revenue || [];
  const series = currencies.find(item => item.currency === selected) || currencies[0];
  const points = series?.points || [], today = points.at(-1), yesterday = points.at(-2);
  return <article className={`${styles.card} ${expanded ? styles.expanded : ""}`} aria-label="Verified revenue">
    <ReceiptText size={22} /><span>Revenue (today)</span>
    <strong>{series && today ? hotelTrendMoney(today.amount_minor, series.currency) : "—"}</strong>
    {currencies.length > 1 ? <label className={styles.currency}>Currency<select value={series?.currency || ""} onChange={event => setSelected(event.target.value)}>{currencies.map(item => <option key={item.currency}>{item.currency}</option>)}</select></label> : null}
    <small aria-label={today && yesterday ? `${hotelTrendLabel(today.amount_minor, yesterday.amount_minor)} vs yesterday` : undefined}>{today && yesterday ? hotelTrendLabel(today.amount_minor, yesterday.amount_minor) : trends ? "No currency configured" : "Trend data unavailable"}</small>
    {series ? <svg className={styles.sparkline} viewBox="0 0 100 34" role="img" aria-label={`Last seven days of verified ${series.currency} receipts`}><polyline points={hotelSparkline(points.slice(-7).map(point => point.amount_minor))} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg> : null}
    {expanded && series ? <table className={styles.daily}><caption>Verified receipts by hotel-local day · {series.currency}</caption><thead><tr><th>Day</th><th>Amount</th></tr></thead><tbody>{points.slice(-7).map(point => <tr key={point.day}><td>{point.day}</td><td>{hotelTrendMoney(point.amount_minor, series.currency)}</td></tr>)}</tbody></table> : null}
    <p className={styles.definition}>By verification date. Pending, rejected and voided records are excluded. Currencies are never combined. Today is a partial day.</p>
  </article>;
}

export default function HotelDashboardMetrics({ data }: { data: HotelOverviewData }) {
  const current = data.trends?.daily.at(-1), previous = data.trends?.daily.at(-2);
  const occupancy = data.active_rooms ? Math.round(data.occupied_rooms / data.active_rooms * 100) : null;
  return <section className={`${styles.metrics} ${!data.canViewPayments ? styles.three : ""}`} aria-label="Today at your hotel">
    <article className={styles.card}><BedDouble size={22} /><span>Total rooms</span><strong>{data.active_rooms}</strong><small>Active physical rooms</small></article>
    <article className={styles.card}><span className={styles.occupancy} aria-label={occupancy === null ? "No active room inventory" : `${occupancy}% currently occupied`}>{occupancy === null ? "—" : `${occupancy}%`}</span><span>Occupied</span><strong>{data.occupied_rooms}</strong><small>Currently checked in</small></article>
    <article className={styles.card}><CalendarCheck size={22} /><span>Check-ins today</span><strong>{current?.checkins ?? "—"}</strong><small aria-label={current && previous ? `${hotelTrendLabel(current.checkins, previous.checkins)} vs yesterday` : undefined}>{current && previous ? hotelTrendLabel(current.checkins, previous.checkins) : "Comparison unavailable"}</small></article>
    {data.canViewPayments ? <HotelRevenueCard trends={data.trends} /> : null}
  </section>;
}
