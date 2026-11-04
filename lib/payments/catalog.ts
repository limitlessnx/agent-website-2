import { supabaseRest } from "@/lib/supabase-server-rest";
import { getFluxPlanDefinition } from "@/lib/fluxknight-plans";
import type { BillingCurrency, BillingRegion } from "@/lib/payments/region";

export type PublicPlan = {
  id: string;
  slug: string;
  name: string;
  description: string;
  currency: BillingCurrency;
  recurringFee: number;
  billingInterval: string;
  custom: boolean;
  metadata: Record<string, unknown>;
};

type BillingPlanRow = {
  id: string;
  slug: string;
  name: string;
  currency: string;
  recurring_fee: number;
  billing_interval: string;
  status: string;
  metadata: Record<string, unknown> | null;
};

const PUBLIC_PRICING: Record<string, {
  planCode: "basic" | "plus" | "business" | "business_plus";
  name: string;
  description: string;
  custom: boolean;
}> = {
  "whatsapp-ai-starter": {
    planCode: "basic",
    name: "Basic",
    description: "AI front desk for customer questions, enquiries, qualification, capture and human handoff.",
    custom: false,
  },
  "ai-call-receptionist": {
    planCode: "plus",
    name: "Plus",
    description: "Everything in Basic, plus automated follow-up, reminders, nurture and missed-lead recovery.",
    custom: false,
  },
  "ai-front-desk-suite": {
    planCode: "business",
    name: "Business",
    description: "Customer operations automation with higher usage, admin controls, cross-channel workflows, reporting and Leo Admin Assistance.",
    custom: false,
  },
  "custom-ai-operations": {
    planCode: "business_plus",
    name: "Business+",
    description: "Advanced customer operations with configurable credits, industry databases, deeper workflows, integrations, dashboards and operational data systems.",
    custom: false,
  },
};

export async function getPublicPlan(slug: string, region: BillingRegion): Promise<PublicPlan | null> {
  const pricing = PUBLIC_PRICING[slug];
  if (!pricing) return null;

  const rows = await supabaseRest<BillingPlanRow[]>(
    `billing_plans?select=id,slug,name,currency,recurring_fee,billing_interval,status,metadata&slug=eq.${encodeURIComponent(slug)}&status=eq.active&limit=1`,
  );
  const plan = rows[0];
  if (!plan || plan.metadata?.public_catalog !== true) return null;

  const international = plan.metadata?.international as { recurring_fee?: number | null } | undefined;
  const recurringFee = region === "NG" ? Number(plan.recurring_fee) : Number(international?.recurring_fee);
  if (!pricing.custom && (!Number.isFinite(recurringFee) || recurringFee <= 0)) return null;
  const fluxPlan = getFluxPlanDefinition(pricing.planCode);

  return {
    id: plan.id,
    slug: plan.slug,
    name: pricing.name,
    description: pricing.description,
    currency: region === "NG" ? "NGN" : "USD",
    recurringFee: pricing.custom ? 0 : recurringFee,
    billingInterval: plan.billing_interval || "monthly",
    custom: pricing.custom || plan.metadata?.custom === true,
    metadata: {
      ...(plan.metadata || {}),
      custom: pricing.custom || plan.metadata?.custom === true,
      plan_code: pricing.planCode,
      monthly_credits: fluxPlan.monthlyCredits,
      pricing_version: "v2-2026-09",
    },
  };
}

export async function getPublicCatalog(region: BillingRegion) {
  const slugs = ["whatsapp-ai-starter", "ai-call-receptionist", "ai-front-desk-suite", "custom-ai-operations"];
  const plans = await Promise.all(slugs.map((slug) => getPublicPlan(slug, region)));
  return plans.filter(Boolean) as PublicPlan[];
}
