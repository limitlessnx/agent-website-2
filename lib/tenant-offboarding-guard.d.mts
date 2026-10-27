export type TenantWorkGateResult<T> =
  | { active: true; value: T }
  | { active: false };

export function runTenantWorkIfActive<T>(
  organizationStatus: string | null | undefined,
  execute: () => T | Promise<T>,
  suppress: () => unknown | Promise<unknown>,
): Promise<TenantWorkGateResult<T>>;
