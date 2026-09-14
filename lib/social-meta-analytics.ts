import type { SupabaseClient } from "@supabase/supabase-js";
import type { SocialAccountMetricSample, SocialPostMetricSample } from "@/lib/social-metric-ingestion";

type Json = Record<string, unknown>;

export type MetaConfig = {
  accessToken: string;
  apiVersion: string;
  pageId?: string;
  instagramBusinessAccountId?: string;
};

const valueOf = (items: unknown, name: string) => {
  if (!Array.isArray(items)) return 0;
  const item = items.find((entry) => typeof entry === "object" && entry && (entry as Json).name === name) as Json | undefined;
  if (!item || !Array.isArray(item.values) || !(item.values as unknown[])[0]) return 0;
  const first = (item.values as Json[])[0];
  const raw = first?.value;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return Number(raw) || 0;
  return 0;
};

async function graph(config: MetaConfig, path: string, params: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${config.apiVersion}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("access_token", config.accessToken);
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body?.error?.message === "string" ? body.error.message : `Meta Graph API ${response.status}`;
    throw new Error(message);
  }
  return body as Json;
}

export async function collectMetaAnalytics(input: {
  supabase: SupabaseClient;
  organizationId: string;
  brandId: string;
  config: MetaConfig;
}) {
  const capturedAt = new Date().toISOString();
  const { data: refs, error } = await input.supabase
    .from("social_post_platform_refs")
    .select("post_id,platform,external_post_id,external_account_id")
    .eq("organization_id", input.organizationId)
    .eq("brand_id", input.brandId)
    .in("platform", ["instagram", "facebook"]);
  if (error) throw error;

  const postSamples: SocialPostMetricSample[] = [];

  for (const ref of refs || []) {
    if (ref.platform === "instagram") {
      const insights = await graph(input.config, `${ref.external_post_id}/insights`, {
        metric: "impressions,reach,likes,comments,shares,saved,total_interactions,views",
        period: "lifetime",
      });
      const data = insights.data;
      postSamples.push({
        postId: ref.post_id,
        platform: "instagram",
        capturedAt,
        externalSnapshotKey: `instagram:${ref.external_post_id}:${capturedAt.slice(0, 13)}`,
        impressions: valueOf(data, "impressions"),
        reach: valueOf(data, "reach"),
        views: valueOf(data, "views"),
        likes: valueOf(data, "likes"),
        comments: valueOf(data, "comments"),
        shares: valueOf(data, "shares"),
        saves: valueOf(data, "saved"),
        metadata: { external_post_id: ref.external_post_id, external_account_id: ref.external_account_id || null },
      });
    }

    if (ref.platform === "facebook") {
      const insights = await graph(input.config, `${ref.external_post_id}/insights`, {
        metric: "post_impressions,post_impressions_unique,post_engaged_users,post_clicks,post_reactions_like_total",
        period: "lifetime",
      });
      const data = insights.data;
      postSamples.push({
        postId: ref.post_id,
        platform: "facebook",
        capturedAt,
        externalSnapshotKey: `facebook:${ref.external_post_id}:${capturedAt.slice(0, 13)}`,
        impressions: valueOf(data, "post_impressions"),
        reach: valueOf(data, "post_impressions_unique"),
        clicks: valueOf(data, "post_clicks"),
        likes: valueOf(data, "post_reactions_like_total"),
        metadata: { external_post_id: ref.external_post_id, external_account_id: ref.external_account_id || null },
      });
    }
  }

  const accountSamples: SocialAccountMetricSample[] = [];

  if (input.config.instagramBusinessAccountId) {
    const profile = await graph(input.config, input.config.instagramBusinessAccountId, { fields: "followers_count,follows_count" });
    const insights = await graph(input.config, `${input.config.instagramBusinessAccountId}/insights`, {
      metric: "impressions,reach,profile_views",
      period: "day",
    });
    accountSamples.push({
      brandId: input.brandId,
      platform: "instagram",
      capturedAt,
      externalSnapshotKey: `instagram-account:${input.config.instagramBusinessAccountId}:${capturedAt.slice(0, 13)}`,
      followers: Number(profile.followers_count || 0),
      following: Number(profile.follows_count || 0),
      impressions: valueOf(insights.data, "impressions"),
      reach: valueOf(insights.data, "reach"),
      profileViews: valueOf(insights.data, "profile_views"),
      metadata: { external_account_id: input.config.instagramBusinessAccountId },
    });
  }

  if (input.config.pageId) {
    const page = await graph(input.config, input.config.pageId, { fields: "followers_count" });
    const insights = await graph(input.config, `${input.config.pageId}/insights`, {
      metric: "page_impressions,page_impressions_unique,page_engaged_users,page_views_total",
      period: "day",
    });
    accountSamples.push({
      brandId: input.brandId,
      platform: "facebook",
      capturedAt,
      externalSnapshotKey: `facebook-account:${input.config.pageId}:${capturedAt.slice(0, 13)}`,
      followers: Number(page.followers_count || 0),
      impressions: valueOf(insights.data, "page_impressions"),
      reach: valueOf(insights.data, "page_impressions_unique"),
      engagements: valueOf(insights.data, "page_engaged_users"),
      profileViews: valueOf(insights.data, "page_views_total"),
      metadata: { external_account_id: input.config.pageId },
    });
  }

  return { postSamples, accountSamples, capturedAt };
}

export async function metaConfigFromIntegration(supabase: SupabaseClient, organizationId: string): Promise<MetaConfig> {
  const rpcClient = supabase as any;
  const [{ data: credentials, error: credentialError }, { data: integration, error: integrationError }] = await Promise.all([
    rpcClient.rpc("get_organization_integration_credentials", {
      p_organization_id: organizationId,
      p_provider: "meta",
    }),
    supabase
      .from("organization_integrations")
      .select("configuration,status")
      .eq("organization_id", organizationId)
      .eq("provider", "meta")
      .maybeSingle(),
  ]);
  if (credentialError) throw credentialError;
  if (integrationError) throw integrationError;
  const secret = (credentials || {}) as Json;
  const configuration = ((integration?.configuration || {}) as Json);
  const accessToken = typeof secret.access_token === "string" ? secret.access_token : "";
  if (!accessToken) throw new Error("Meta integration has no stored access token.");
  return {
    accessToken,
    apiVersion: typeof configuration.api_version === "string" ? configuration.api_version : process.env.META_GRAPH_API_VERSION || "v24.0",
    pageId: typeof configuration.page_id === "string" ? configuration.page_id : undefined,
    instagramBusinessAccountId: typeof configuration.instagram_business_account_id === "string" ? configuration.instagram_business_account_id : undefined,
  };
}

export function metaConfigFromEnvironment(): MetaConfig {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) throw new Error("META_ACCESS_TOKEN is not configured in the Trigger.dev environment.");
  return {
    accessToken,
    apiVersion: process.env.META_GRAPH_API_VERSION || "v24.0",
    pageId: process.env.META_PAGE_ID || undefined,
    instagramBusinessAccountId: process.env.META_IG_ACCOUNT_ID || undefined,
  };
}
