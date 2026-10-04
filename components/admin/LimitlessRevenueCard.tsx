"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, BarChart2, CalendarDays, CreditCard, WalletCards } from "@/components/admin/ServerIcons";
import { formatNaira } from "@/lib/limitless-payments";
import type { LimitlessDashboardData } from "@/lib/admin-organization-data";
import styles from "./DashboardHomeExperience.module.css";

export default function LimitlessRevenueCard({ financial }: { financial: LimitlessDashboardData["financial"] }) {
  const [period, setPeriod] = useState<"year" | "month">("year");
  const amount = period === "year" ? financial.yearCollected : financial.monthCollected;
  const label = period === "year" ? "This year" : "This month";
  const maxBar = Math.max(...financial.recentCollectionSeries, 1);

  return (
    <section className={styles.financeHero} aria-labelledby="finance-heading">
      <div className={styles.financeHeader}>
        <div>
          <span className={styles.cardKicker}><WalletCards size={15} /> REVENUE COLLECTED</span>
          <strong id="finance-heading">{formatNaira(amount)}</strong>
          <span className={styles.financePeriod}>{label}</span>
        </div>
        <div className={styles.financeChart} aria-label="Last seven days of recorded collections">
          {financial.recentCollectionSeries.map((value, index) => (
            <span key={index} style={{ height: Math.max(8, (value / maxBar) * 100) + "%" }} />
          ))}
        </div>
      </div>
      <div className={styles.financeMeta}>
        <span><ArrowUpRight size={15} /> {formatNaira(financial.todayCollected)} today</span>
        <small>{formatNaira(financial.collected)} collected across recorded installment plans</small>
      </div>
      <div className={styles.financeActions}>
        <Link href="/dashboard/limitless/payments"><CreditCard size={16} /><span>Record Payment</span></Link>
        <Link href="/dashboard/limitless/payments/installments"><CalendarDays size={16} /><span>View Installments</span></Link>
        <Link href="/dashboard/limitless/payments"><BarChart2 size={16} /><span>View Collections</span></Link>
      </div>
      <label className={styles.financePeriodSwitch}>
        <span>View</span>
        <select value={period} onChange={(event) => setPeriod(event.target.value as "year" | "month")} aria-label="Revenue period">
          <option value="year">Year</option>
          <option value="month">Month</option>
        </select>
      </label>
    </section>
  );
}
