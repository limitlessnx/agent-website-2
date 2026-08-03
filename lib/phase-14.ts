import { createAdminClient } from "@/lib/supabase/admin";

export type BillingPlan = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  installation_fee: number;
  recurring_fee: number;
  billing_interval: string;
  status: string;
  metadata: Record<string, unknown>;
  entitlements: Array<{ feature_key: string; enabled: boolean; limit_value: number | null }>;
};

export async function getPhase14Summary() {
  const admin = createAdminClient();
  const [plansResult, subscriptionsResult, usageResult, templatesResult, organizationsResult] = await Promise.all([
    admin.from("billing_plans").select("id,name,slug,currency,installation_fee,recurring_fee,billing_interval,status,metadata,plan_entitlements(feature_key,enabled,limit_value)").order("recurring_fee"),
    admin.from("organization_subscriptions").select("id,organization_id,plan_id,status,provider,current_period_end,organizations(name),billing_plans(name,slug)").order("updated_at", { ascending: false }).limit(100),
    admin.from("usage_ledger").select("organization_id,usage_type,quantity,total_cost_minor,occurred_at").order("occurred_at", { ascending: false }).limit(500),
    admin.from("organization_templates").select("id,name,slug,industry,status,agents,modules,workflows").order("industry"),
    admin.from("organizations").select("id,name,status").order("name").limit(200),
  ]);

  for (const result of [plansResult, subscriptionsResult, usageResult, templatesResult, organizationsResult]) {
    if (result.error) throw result.error;
  }

  const usage = usageResult.data || [];
  const usageCostMinor = usage.reduce((sum, item) => sum + Number(item.total_cost_minor || 0), 0);
  const activeSubscriptions = (subscriptionsResult.data || []).filter((item) => item.status === "active").length;

  return {
    plans: (plansResult.data || []).map((plan: any) => ({ ...plan, entitlements: plan.plan_entitlements || [] })) as BillingPlan[],
    subscriptions: subscriptionsResult.data || [],
    usage,
    templates: templatesResult.data || [],
    organizations: organizationsResult.data || [],
    metrics: {
      activeSubscriptions,
      templates: (templatesResult.data || []).filter((item) => item.status === "active").length,
      usageEvents: usage.length,
      usageCostMinor,
    },
  };
}
