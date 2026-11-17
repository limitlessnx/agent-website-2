export type TenantStage = "organization_created" | "provisioning_in_progress" | "awaiting_customer_configuration" | "needs_attention" | "ready_for_testing" | "ready_for_activation" | "active";
export type ReadinessCheck = { key: string; label: string; ready: boolean; action: string; href: string };
export type TenantReadiness = { stage: TenantStage; checks: ReadinessCheck[]; blockers: ReadinessCheck[] };
export const tenantStageLabels: Record<TenantStage, string> = {
  organization_created: "Organization created", provisioning_in_progress: "Provisioning in progress",
  awaiting_customer_configuration: "Awaiting customer configuration", needs_attention: "Needs attention",
  ready_for_testing: "Ready for testing", ready_for_activation: "Ready for activation", active: "Active",
};

/** Conservative projection of existing evidence; never activates or provisions anything. */
export function evaluateTenantReadiness(input: {
  checks: ReadinessCheck[]; provisioning: string; live: boolean; hasSetup: boolean; unavailable?: boolean;
}): TenantReadiness {
  const blockers = input.checks.filter(check => !check.ready);
  const setupBlockers = blockers.filter(check => !["tests", "approval"].includes(check.key));
  let stage: TenantStage;
  if (input.unavailable || input.provisioning === "needs_attention" || (input.live && blockers.length)) stage = "needs_attention";
  else if (input.provisioning === "provisioning") stage = "provisioning_in_progress";
  else if (!input.hasSetup) stage = "organization_created";
  else if (setupBlockers.length) stage = "awaiting_customer_configuration";
  else if (blockers.some(check => check.key === "tests")) stage = "ready_for_testing";
  else if (input.live && !blockers.length) stage = "active";
  else stage = "ready_for_activation";
  return { stage, checks: input.checks, blockers };
}
