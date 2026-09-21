import { industries, planDefinitions, type PlanDefinition } from "@/lib/industryCatalog";
import { LEO_PUBLIC_KNOWLEDGE } from "@/lib/leo-public-knowledge";
import { getPublicCatalog } from "@/lib/payments/catalog";
import { upsertLeoPublicLead } from "@/lib/leo-public-leads";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown, max = 1200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function allText(args: Record<string, unknown>) {
  try { return JSON.stringify(args).toLowerCase(); } catch { return ""; }
}
function plan(key: PlanDefinition["key"]) {
  return planDefinitions.find((item) => item.key === key) || planDefinitions[0];
}
function publicPlan(planDef: PlanDefinition) {
  return {
    key: planDef.key,
    name: planDef.name,
    summary: planDef.summary,
    bestFor: planDef.bestFor,
    includes: planDef.includes,
    notIncluded: planDef.notIncluded || [],
    unavailable: planDef.unavailable || [],
    comingSoon: planDef.comingSoon || [],
  };
}

export function recommendPublicPlan(args: Record<string, unknown>) {
  const haystack = allText(args);
  const wantsCustom = /custom integration|bespoke|multiple departments|multi-department|multiple branches|multi-branch|custom system|custom dashboard|erp|bespoke logic/.test(haystack);
  const wantsDatabase = /database|service history|customer history|lifecycle|birthday|anniversary|renewal history|vehicle history|property database|structured records|segmentation/.test(haystack);
  const wantsBusiness = /cross-channel|cross channel|whatsapp and email|multiple channels|team access|admin|reporting|voice|call agent|phone agent|customer context across/.test(haystack);
  const wantsPlus = /follow.?up|reminder|nurture|missed lead|inspection reminder|booking reminder|appointment reminder|quote reminder|maintenance reminder|service reminder|check.?in/.test(haystack);

  let recommended: PlanDefinition | { key: "custom"; name: "Custom"; summary: string; bestFor: string; includes: string[] };
  let reason: string;
  if (wantsCustom) {
    recommended = {
      key: "custom",
      name: "Custom",
      summary: "A scoped implementation for requirements outside the standard package boundaries.",
      bestFor: "Businesses needing unusual integrations, bespoke systems, multiple departments or advanced custom logic.",
      includes: ["Scoped around the exact business requirement", "Custom integrations and implementation plan", "Human discovery before final pricing"],
    };
    reason = "The requirement goes beyond a standard package and needs implementation scoping.";
  } else if (wantsDatabase) {
    recommended = plan("business-plus");
    reason = "The requirement depends on structured customer or operational history, lifecycle visibility or deeper records that go beyond ordinary follow-up.";
  } else if (wantsBusiness) {
    recommended = plan("business");
    reason = "The requirement needs team controls, cross-channel context, higher usage, reporting or voice capability when configured.";
  } else if (wantsPlus) {
    recommended = plan("starter");
    reason = "The requirement includes future follow-up, reminders or nurture. Basic deliberately does not include those.";
  } else {
    recommended = plan("basic");
    reason = "The current need is primarily immediate customer support, qualification, detail capture and human handoff.";
  }

  return {
    ok: true,
    status: "recommended",
    recommendedPlan: "key" in recommended ? recommended.key : "custom",
    plan: recommended,
    reason,
    guardrails: LEO_PUBLIC_KNOWLEDGE.planRules,
  };
}

export async function executePublicLeoTool(input: {
  toolKey: string;
  args: Record<string, unknown>;
  sessionId?: string;
}) {
  const { toolKey, args } = input;

  if (toolKey === "leo.public.services.read") {
    return { ok: true, status: "read", operatingModel: LEO_PUBLIC_KNOWLEDGE.operatingModel, evaluationRules: LEO_PUBLIC_KNOWLEDGE.evaluationRules };
  }
  if (toolKey === "leo.public.industries.read") {
    return { ok: true, status: "read", industries: industries.map((item) => ({ slug: item.slug, name: item.name, outcomes: item.outcomes, basicExample: item.basicExample, plusExample: item.starterExample, businessExample: item.businessExample, businessPlusExample: item.businessPlusExample })) };
  }
  if (toolKey === "leo.public.pricing.read") {
    const region = text(args.region, 30).toUpperCase() === "INTERNATIONAL" ? "INTERNATIONAL" : "NG";
    const pricing = await getPublicCatalog(region).catch(() => []);
    return {
      ok: true,
      status: "read",
      region,
      plans: planDefinitions.map((definition) => {
        const priced = pricing.find((item) => String(item.metadata.plan_code || "").replace("_", "-") === definition.key || item.name === definition.name);
        return { ...publicPlan(definition), pricing: priced ? { currency: priced.currency, installationFee: priced.installationFee, recurringFee: priced.recurringFee, billingInterval: priced.billingInterval } : null };
      }),
      trial: LEO_PUBLIC_KNOWLEDGE.trial,
      voiceAvailability: LEO_PUBLIC_KNOWLEDGE.availability.voice,
    };
  }
  if (toolKey === "leo.public.plan.recommend") return recommendPublicPlan(args);

  if (toolKey === "leo.public.lead.capture") {
    const sessionId = text(input.sessionId, 120);
    const name = text(args.name, 180);
    const email = text(args.email, 240).toLowerCase();
    if (!sessionId || !name || !email) return { ok: false, status: "missing_details", error: "Name, email and session are required." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, status: "invalid_email", error: "The email address is not valid." };
    const lead = await upsertLeoPublicLead({ sessionId, name, email, phone: args.phone, companyName: args.organization || args.business_name, industry: args.industry || args.business_type, notes: args.main_goal, metadata: { captured_by: "public_leo" } });
    return { ok: true, status: "captured", leadId: lead.id, leadCaptured: true };
  }

  if (toolKey === "leo.public.evaluation.update") {
    const sessionId = text(input.sessionId, 120);
    if (!sessionId) return { ok: false, status: "missing_session", error: "A Public Leo session is required." };
    const qualification = {
      business_need: text(args.business_need || args.summary, 2000),
      pain_points: Array.isArray(args.pain_points) ? args.pain_points.slice(0, 10) : [],
      opportunities: Array.isArray(args.opportunities) ? args.opportunities.slice(0, 10) : [],
      channels: Array.isArray(args.channels) ? args.channels.slice(0, 10) : [],
      requested_capabilities: Array.isArray(args.requested_capabilities) ? args.requested_capabilities.slice(0, 12) : [],
      plan_reason: text(args.plan_reason, 1000),
      trial_discussed: args.trial_discussed === true,
    };
    const recommendation = args.recommended_plan ? recommendPublicPlan({ ...args, requested: args.requested_capabilities }) : null;
    const lead = await upsertLeoPublicLead({
      sessionId,
      companyName: args.business_name,
      industry: args.industry,
      recommendedPlan: text(args.recommended_plan, 80) || recommendation?.plan?.name,
      qualification,
      notes: text(args.conversation_summary || args.summary, 2000),
      status: "evaluated",
      metadata: { last_evaluation_update_at: new Date().toISOString() },
    });
    return { ok: true, status: "updated", leadId: lead.id };
  }

  if (toolKey === "leo.public.handoff.request" || toolKey === "leo.public.demo.book") {
    const sessionId = text(input.sessionId, 120);
    if (!sessionId) return { ok: false, status: "missing_session", error: "A Public Leo session is required." };
    const lead = await upsertLeoPublicLead({
      sessionId,
      phone: args.phone || args.whatsapp,
      preferredContactMethod: args.preferred_contact_method || args.contact_method,
      handoffRequested: true,
      status: "follow_up_requested",
      notes: args.summary || args.reason,
      metadata: { handoff_requested_at: new Date().toISOString() },
    });
    return { ok: true, status: "handoff_requested", leadId: lead.id, message: "The visitor's request and current evaluation are saved for Fluxknight management follow-up." };
  }

  return { ok: false, status: "unsupported_public_tool", error: "This Public Leo tool is not handled locally." };
}
