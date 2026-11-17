import styles from "@/components/ui/DashboardPrimitives.module.css";
import type { ComponentType } from "react";

export default function MetricCard({
  label,
  value,
  detail,
  trend,
  icon: Icon,
  tone = "violet",
}: {
  label: string;
  value: string | number;
  detail?: string;
  trend?: string;
  icon?: ComponentType<{ size?: number }>;
  tone?: "cyan" | "emerald" | "amber" | "rose" | "violet";
}) {
  return (
    <div className={`${styles.card} ${styles.metric}`} data-tone={tone}>
      <div className={styles.metricTopline}>
        {Icon ? (
          <span className={styles.metricIcon} aria-hidden="true">
            <Icon size={17} />
          </span>
        ) : null}
        {trend ? <em>{trend}</em> : null}
      </div>
      <p>{label}</p>
      <strong>{value}</strong>
      {detail ? <span>{detail}</span> : null}
    </div>
  );
}
