// Optional business automation must not invalidate an already-permitted core reply.
// This does not grant entitlement: the operation's own gates remain authoritative.
export async function runOptionalRealEstateOperation<T>(operation: () => Promise<T>) {
  try {
    return { status: "scheduled" as const, result: await operation() };
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    const gated = name === "FluxFeatureGateError" || name === "FluxTrialFeatureGateError";
    return { status: gated ? "unavailable" as const : "failed" as const,
      errorCode: gated ? "feature_not_entitled" : "optional_operation_failed",
      errorName: name };
  }
}
