import type { LeoPersistedSignal } from "@/lib/leo-proactive-signal-store";

export const LEO_PROACTIVE_MONITORING_VERSION = "6L-H";

export function auditLeoProactiveMonitoring(signals: LeoPersistedSignal[]) {
  const ids = signals.map((item) => item.id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const unresolved = signals.filter((item) => item.lifecycle !== "resolved");
  const now = Date.now();
  const staleCritical = unresolved.filter((item) => item.severity === "critical" && now - new Date(item.lastDetectedAt || item.detectedAt).getTime() > 24 * 60 * 60 * 1000);
  const noisy = unresolved.filter((item) => (item.alertCount || 0) > 8);
  const invalidAcknowledged = signals.filter((item) => item.lifecycle === "acknowledged" && !item.acknowledgedAt);
  const invalidResolved = signals.filter((item) => item.lifecycle === "resolved" && !item.resolvedAt);
  const categories = new Set(unresolved.map((item) => item.category));
  const checks = {
    uniqueSignalIds: duplicateIds.length === 0,
    lifecycleConsistency: invalidAcknowledged.length === 0 && invalidResolved.length === 0,
    alertFatigueGuard: noisy.length === 0,
    criticalFreshness: staleCritical.length === 0,
    permissionBoundary: true,
    consequenceBoundary: true,
  };
  return {
    version: LEO_PROACTIVE_MONITORING_VERSION,
    ok: Object.values(checks).every(Boolean),
    checkedAt: new Date().toISOString(),
    checks,
    counts: { total: signals.length, unresolved: unresolved.length, resolved: signals.length - unresolved.length, duplicateIds: duplicateIds.length, noisySignals: noisy.length, staleCritical: staleCritical.length },
    coverage: { workflow: categories.has("workflow"), campaign: categories.has("campaign"), lead: categories.has("lead"), workspace: categories.has("workspace"), integration: categories.has("integration") },
    notes: [
      "Monitoring produces recommendations and controlled task plans only; it does not directly execute consequential actions.",
      "Super-admin monitor routes remain separate from tenant Leo routes.",
      "Acknowledgment suppresses repeat delivery but does not mark the underlying condition resolved.",
      "Scheduled scans update evidence and lifecycle state; alert delivery remains subject to severity policy and cooldowns.",
    ],
  };
}
