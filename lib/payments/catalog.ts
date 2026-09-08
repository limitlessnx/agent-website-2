import { supabaseRest } from "@/lib/supabase-server-rest";
import { getFluxPlanDefinition } from "@/lib/fluxknight-plans";
import type { BillingCurrency, BillingRegion } from "@/lib/payments/region";

export type PublicPlan = {
  id: string;
  slug: string;
  name: string;
  description: string;
  currency: BillingCurrency;
  installationFee: number;
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
  installation_fee: number;
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
  ng: { setup: number; recurring: number };
  international: { setup: number; recurring: number };
}> = {
  "whatsapp-ai-starter": {
    planCode: "basic",
    name: "Basic",
    description: "AI front desk for customer questions, enquiries, qualification, capture and human handoff.",
    custom: false,
    ng: { setup: 150000, recurring: 50000 },
    international: { setup: 500, recurring: 100 },
  },
  "ai-call-receptionist": {
    planCode: "plus",
    name: "Plus",
    description: "Everything in Basic, plus automated follow-up, reminders, nurture and missed-lead recovery.",
    custom: false,
    ng: { setup: 300000, recurring: 100000 },
    international: { setup: 1000, recurring: 250 },
  },
  "ai-front-desk-suite": {
    planCode: "business",
    name: "Business",
    description: "Customer operations automation with higher usage, admin controls, cross-channel workflows, reporting and Leo Admin Assistance.",
    custom: false,
    ng: { setup: 750000, recurring: 250000 },
    international: { setup: 2500, recurring: 500 },
  },
  "custom-ai-operations": {
    planCode: "business_plus",
    name: "Business+",
    description: "Advanced customer operations with configurable credits, industry databases, deeper workflows, integrations, dashboards and operational data systems.",
    custom: false,
    ng: { setup: 2000000, recurring: 500000 },
    international: { setup: 5000, recurring: 1000 },
  },
};

export async function getPublicPlan(slug: string, region: BillingRegion): Promise<PublicPlan | null> {
  const pricing = PUBLIC_PRICING[slug];
  if (!pricing) return null;

  const rows = await supabaseRest<BillingPlanRow[]>(
    `billing_plans?select=id,slug,name,currency,installation_fee,recurring_fee,billing_interval,status,metadata&slug=eq.${encodeURIComponent(slug)}&status=eq.active&limit=1`,
  );
  const plan = rows[0];
  if (!plan || plan.metadata?.public_catalog !== true) return null;

  const selected = region === "NG" ? pricing.ng : pricing.international;
  const fluxPlan = getFluxPlanDefinition(pricing.planCode);

  return {
    id: plan.id,
    slug: plan.slug,
    name: pricing.name,
    description: pricing.description,
    currency: region === "NG" ? "NGN" : "USD",
    installationFee: selected.setup,
    recurringFee: selected.recurring,
    billingInterval: plan.billing_interval || "monthly",
    custom: pricing.custom,
    metadata: {
      ...(plan.metadata || {}),
      custom: pricing.custom,
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
