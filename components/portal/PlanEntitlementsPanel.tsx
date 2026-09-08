import Link from "next/link";
import { LockKeyhole } from "@/components/admin/ServerIcons";
import { FLUX_FEATURE_LABELS, getUpgradeLabel, planIncludesFeature, type FluxFeatureKey, type FluxPlanCode } from "@/lib/fluxknight-plans";

const FEATURES: FluxFeatureKey[] = [
  "core_ai_support",
  "leo_chat",
  "follow_ups",
  "reminders",
  "team_admin",
  "cross_channel",
  "leo_voice",
  "industry_database",
  "client_database",
  "advanced_workflows",
  "custom_integrations",
];

export default function PlanEntitlementsPanel({ planCode }: { planCode: FluxPlanCode }) {
  return (
    <article className="portal-card">
      <div className="portal-card-head"><div><h2>Plan access</h2><p>Available features stay visible. Locked items show the plan needed to unlock them.</p></div></div>
      <div className="portal-list">
        {FEATURES.map((feature) => {
          const unlocked = planIncludesFeature(planCode, feature);
          const upgrade = getUpgradeLabel(feature, planCode);
          return (
            <div className="portal-list-row" key={feature} style={{ opacity: unlocked ? 1 : 0.72 }}>
              <div><strong>{FLUX_FEATURE_LABELS[feature]}</strong><span>{unlocked ? "Included in your plan" : upgrade}</span></div>
              {unlocked ? <em>Active</em> : <em><LockKeyhole size={13} /> Upgrade</em>}
            </div>
          );
        })}
      </div>
      <div className="portal-actions" style={{ marginTop: 20 }}><Link className="portal-button secondary" href="/pricing#plan-details">Compare plans</Link></div>
    </article>
  );
}
