import { requireTenant } from "@/lib/tenant";

export type SocialMetricPlatform = "instagram" | "facebook" | "linkedin" | "tiktok" | "youtube" | "x" | "other";

export type SocialPostMetric = {
  id: string;
  organization_id: string;
  post_id: string;
  platform: SocialMetricPlatform;
  source: "manual" | "platform_api" | "import" | "system";
  captured_at: string;
  impressions: number;
  reach: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  profile_visits: number;
  followers_gained: number;
  watch_time_ms: number;
  average_watch_time_ms: number;
  conversions: number;
  revenue_attributed: number;
  metadata: Record<string, unknown>;
};

export type SocialAccountMetric = {
  id: string;
  organization_id: string;
  brand_id: string;
  platform: SocialMetricPlatform;
  source: "manual" | "platform_api" | "import" | "system";
  captured_at: string;
  followers: number;
  following: number;
  profile_views: number;
  impressions: number;
  reach: number;
  engagements: number;
  website_clicks: number;
  metadata: Record<string, unknown>;
};

export type SocialAnalyticsSummary = {
  impressions: number;
  reach: number;
  views: number;
  engagements: number;
  clicks: number;
  followersGained: number;
  conversions: number;
  revenueAttributed: number;
  engagementRate: number;
  clickThroughRate: number;
};

const n = (value: unknown) => Number(value || 0);

function latestByKey<T extends { captured_at: string }>(rows: T[], key: (row: T) => string) {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const k = key(row);
    if (!latest.has(k)) latest.set(k, row);
  }
  return [...latest.values()];
}

export async function listSocialPostMetrics(limit = 1000): Promise<SocialPostMetric[]> {
  const { supabase, organizationId } = await requireTenant();
  const { data, error } = await supabase
    .from("social_post_metrics")
    .select("*")
    .eq("organization_id", organizationId)
    .order("captured_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as SocialPostMetric[];
}

export async function listSocialAccountMetrics(limit = 500): Promise<SocialAccountMetric[]> {
  const { supabase, organizationId } = await requireTenant();
  const { data, error } = await supabase
    .from("social_account_metrics")
    .select("*")
    .eq("organization_id", organizationId)
    .order("captured_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as SocialAccountMetric[];
}

export async function getSocialAnalyticsSnapshot() {
  const [postMetrics, accountMetrics] = await Promise.all([
    listSocialPostMetrics(),
    listSocialAccountMetrics(),
  ]);

  const latestPostMetrics = latestByKey(postMetrics, (row) => `${row.post_id}:${row.platform}`);
  const latestAccountMetrics = latestByKey(accountMetrics, (row) => `${row.brand_id}:${row.platform}`);

  const summary = latestPostMetrics.reduce<SocialAnalyticsSummary>((acc, row) => {
    const engagements = n(row.likes) + n(row.comments) + n(row.shares) + n(row.saves);
    acc.impressions += n(row.impressions);
    acc.reach += n(row.reach);
    acc.views += n(row.views);
    acc.engagements += engagements;
    acc.clicks += n(row.clicks);
    acc.followersGained += n(row.followers_gained);
    acc.conversions += n(row.conversions);
    acc.revenueAttributed += n(row.revenue_attributed);
    return acc;
  }, {
    impressions: 0,
    reach: 0,
    views: 0,
    engagements: 0,
    clicks: 0,
    followersGained: 0,
    conversions: 0,
    revenueAttributed: 0,
    engagementRate: 0,
    clickThroughRate: 0,
  });

  summary.engagementRate = summary.impressions > 0 ? (summary.engagements / summary.impressions) * 100 : 0;
  summary.clickThroughRate = summary.impressions > 0 ? (summary.clicks / summary.impressions) * 100 : 0;

  return { summary, latestPostMetrics, latestAccountMetrics };
}

export async function recordSocialPostMetricSnapshot(input: Omit<SocialPostMetric, "id" | "organization_id">) {
  const { supabase, organizationId } = await requireTenant();
  const { data: post, error: postError } = await supabase
    .from("social_posts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", input.post_id)
    .maybeSingle();
  if (postError) throw postError;
  if (!post) throw new Error("Social post does not belong to the active organization.");

  const { data, error } = await supabase
    .from("social_post_metrics")
    .insert({ ...input, organization_id: organizationId })
    .select("*")
    .single();
  if (error) throw error;
  return data as SocialPostMetric;
}

export async function recordSocialAccountMetricSnapshot(input: Omit<SocialAccountMetric, "id" | "organization_id">) {
  const { supabase, organizationId } = await requireTenant();
  const { data: brand, error: brandError } = await supabase
    .from("social_brands")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", input.brand_id)
    .maybeSingle();
  if (brandError) throw brandError;
  if (!brand) throw new Error("Social brand does not belong to the active organization.");

  const { data, error } = await supabase
    .from("social_account_metrics")
    .insert({ ...input, organization_id: organizationId })
    .select("*")
    .single();
  if (error) throw error;
  return data as SocialAccountMetric;
}
