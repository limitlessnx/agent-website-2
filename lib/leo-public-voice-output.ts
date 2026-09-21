function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function publicLeoVoiceToolOutput(
  toolKey: string,
  value: unknown,
  transportOk: boolean,
): Record<string, unknown> {
  const data = asObject(value);
  const ok = transportOk && data.ok !== false;

  if (!ok) {
    return {
      ok: false,
      continue_conversation: true,
      customer_action_required: false,
    };
  }

  if (toolKey === "leo.public.pricing.read") {
    return {
      ok: true,
      plans: data.plans || [],
      trial: data.trial || null,
      voice_availability: data.voiceAvailability || null,
    };
  }

  if (toolKey === "leo.public.plan.recommend") {
    return {
      ok: true,
      recommended_plan: data.plan || null,
      reason: data.reason || null,
    };
  }

  if (toolKey === "leo.public.services.read") {
    return {
      ok: true,
      operating_model: data.operatingModel || [],
      evaluation_rules: data.evaluationRules || [],
    };
  }

  if (toolKey === "leo.public.industries.read") {
    return { ok: true, industries: data.industries || [] };
  }

  if (toolKey === "leo.public.handoff.request" || toolKey === "leo.public.demo.book") {
    return { ok: true, human_follow_up_requested: true };
  }

  return {
    ok: true,
    continue_conversation: true,
  };
}
