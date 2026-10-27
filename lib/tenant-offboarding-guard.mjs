export async function runTenantWorkIfActive(organizationStatus, execute, suppress) {
  if (organizationStatus !== "active") {
    await suppress();
    return { active: false };
  }
  return { active: true, value: await execute() };
}
