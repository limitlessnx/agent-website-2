import { supabaseRest } from "@/lib/supabase-server-rest";
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

export async function getPublicPlan(slug: string, region: BillingRegion): Promise<PublicPlan | null> {
  const rows = await supabaseRest<BillingPlanRow[]>(
    `billing_plans?select=id,slug,name,currency,installation_fee,recurring_fee,billing_interval,status,metadata&slug=eq.${encodeURIComponent(slug)}&status=eq.active&limit=1`,
  );
  const plan = rows[0];
  if (!plan || plan.metadata?.public_catalog !== true) return null;

  if (region === "NG") {
    return {
      id: plan.id,
      slug: plan.slug,
      name: plan.name,
      description: String(plan.metadata?.description || ""),
      currency: "NGN",
      installationFee: Number(plan.installation_fee),
      recurringFee: Number(plan.recurring_fee),
      billingInterval: plan.billing_interval,
      custom: plan.metadata?.custom === true,
      metadata: plan.metadata || {},
    };
  }

  const international = (plan.metadata?.international || {}) as Record<string, unknown>;
  const envPrefix = `FLUXKNIGHT_USD_${plan.slug.replaceAll("-", "_").toUpperCase()}`;
  const setupEnv = process.env[`${envPrefix}_SETUP`];
  const recurringEnv = process.env[`${envPrefix}_RECURRING`];
  const installationFee = Number(international.installation_fee ?? setupEnv ?? 0);
  const recurringFee = Number(international.recurring_fee ?? recurringEnv ?? 0);
  const custom = plan.metadata?.custom === true;

  if (!custom && (!installationFee || !recurringFee)) return null;

  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    description: String(plan.metadata?.description || ""),
    currency: "USD",
    installationFee,
    recurringFee,
    billingInterval: plan.billing_interval,
    custom,
    metadata: plan.metadata || {},
  };
}

export async function getPublicCatalog(region: BillingRegion) {
  const slugs = ["whatsapp-ai-starter", "ai-call-receptionist", "ai-front-desk-suite", "custom-ai-operations"];
  const plans = await Promise.all(slugs.map((slug) => getPublicPlan(slug, region)));
  return plans.filter(Boolean) as PublicPlan[];
}
