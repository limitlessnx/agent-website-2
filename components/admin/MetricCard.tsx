import type { ComponentType } from "react";

export default function MetricCard({
  label,
  value,
  detail,
  trend,
  icon: Icon,
  tone = "cyan",
}: {
  label: string;
  value: string | number;
  detail?: string;
  trend?: string;
  icon?: ComponentType<{ size?: number }>;
  tone?: "cyan" | "emerald" | "amber" | "rose" | "violet";
}) {
  return (
    <div className={`admin-metric-card tone-${tone}`}>
      <div className="admin-metric-topline">
        {Icon ? (
          <span className="admin-metric-icon">
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
