"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BarChart2, CalendarDays, CreditCard, WalletCards } from "@/components/admin/ServerIcons";
import { formatNaira } from "@/lib/limitless-payments";
import styles from "./DashboardHomeExperience.module.css";

export default function RevenueHero({
  yearCollected,
  monthCollected,
  todayCollected,
  collected,
  recentCollectionSeries,
}: {
  yearCollected: number;
  monthCollected: number;
  todayCollected: number;
  collected: number;
  recentCollectionSeries: number[];
}) {
  const [revenuePeriod, setRevenuePeriod] = useState<"year" | "month">("year");
  const maxBar = Math.max(...recentCollectionSeries, 1);

  return (
    <section className={styles.financeHero} aria-labelledby="finance-heading">
      <label className={styles.financePeriodSwitch}>
        <span>View</span>
        <select value={revenuePeriod} onChange={(event) => setRevenuePeriod(event.target.value as "year" | "month")} aria-label="Revenue period">
          <option value="year">Year</option>
          <option value="month">Month</option>
        </select>
      </label>
      <div className={styles.financeHeader}>
        <div><span className={styles.cardKicker}><WalletCards size={15} /> REVENUE COLLECTED</span><strong id="finance-heading">{formatNaira(revenuePeriod === "year" ? yearCollected : monthCollected)}</strong><span className={styles.financePeriod}>{revenuePeriod === "year" ? "This year" : "This month"}</span></div>
        <div className={styles.financeChart} aria-label="Last seven days of recorded collections">
          {recentCollectionSeries.map((value, index) => <span key={index} style={{ height: Math.max(8, (value / maxBar) * 100) + "%" }} />)}
        </div>
      </div>
      <div className={styles.financeMeta}><span><ArrowUpRight size={15} /> {formatNaira(todayCollected)} today</span><small>{formatNaira(collected)} collected across recorded installment plans</small></div>
      <div className={styles.financeActions}>
        <Link href="/dashboard/limitless/payments"><CreditCard size={16} /><span>Record Payment</span></Link>
        <Link href="/dashboard/limitless/payments/installments"><CalendarDays size={16} /><span>View Installments</span></Link>
        <Link href="/dashboard/limitless/payments"><BarChart2 size={16} /><span>View Collections</span></Link>
      </div>
    </section>
  );
}
