import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SocialAccountMetricSample,
  SocialPostMetricSample,
} from "@/lib/social-metric-ingestion";

type Json = Record<string, unknown>;

export type MetaConfig = {
  accessToken: string;
  apiVersion: string;
  pageId?: string;
  instagramBusinessAccountId?: string;
};

function numeric(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

const valueOf = (items: unknown, name: string) => {
  if (!Array.isArray(items)) return 0;
  const item = items.find(
    (entry) =>
      typeof entry === "object" &&
      entry &&
      (entry as Json).name === name,
  ) as Json | undefined;

  if (!item) return 0;

  const totalValue = item.total_value;
  if (typeof totalValue === "object" && totalValue) {
    return numeric((totalValue as Json).value);
  }

  if (Array.isArray(item.values) && item.values[0]) {
    return numeric((item.values[0] as Json).value);
  }

  return numeric(item.value);
};

async function graph(
  config: MetaConfig,
  path: string,
  params: Record<string, string>,
) {
  const url = new URL(
    `https://graph.facebook.com/${config.apiVersion}/${path.replace(/^\//, "")}`,
  );
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("access_token", config.accessToken);

  const response = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof body?.error?.message === "string"
        ? body.error.message
        : `Meta Graph API ${response.status}`;
    throw new Error(message);
  }

  return body as Json;
}

async function safeGraph(
  config: MetaConfig,
  path: string,
  params: Record<string, string>,
) {
  try {
    return await graph(config, path, params);
  } catch {
    return null;
  }
}

async function insightMetric(
  config: MetaConfig,
  path: string,
  metric: string,
  period: string,
  extra: Record<string, string> = {},
) {
  const result = await safeGraph(config, path, {
    metric,
    period,
    ...extra,
  });
  return result ? valueOf(result.data, metric) : 0;
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
      const [media, views, reach, shares, saves] = await Promise.all([
        safeGraph(input.config, ref.external_post_id, {
          fields: "id,media_type,like_count,comments_count",
        }),
        insightMetric(
          input.config,
          `${ref.external_post_id}/insights`,
          "views",
          "lifetime",
        ),
        insightMetric(
          input.config,
          `${ref.external_post_id}/insights`,
          "reach",
          "lifetime",
        ),
        insightMetric(
          input.config,
          `${ref.external_post_id}/insights`,
          "shares",
          "lifetime",
        ),
        insightMetric(
          input.config,
          `${ref.external_post_id}/insights`,
          "saved",
          "lifetime",
        ),
      ]);

      postSamples.push({
        postId: ref.post_id,
        platform: "instagram",
        capturedAt,
        externalSnapshotKey: `instagram:${ref.external_post_id}:${capturedAt.slice(0, 13)}`,
        views,
        reach,
        likes: numeric(media?.like_count),
        comments: numeric(media?.comments_count),
        shares,
        saves,
        metadata: {
          external_post_id: ref.external_post_id,
          external_account_id: ref.external_account_id || null,
          media_type: media?.media_type || null,
          meta_metric_generation: "2026_current",
        },
      });
    }

    if (ref.platform === "facebook") {
      const [post, mediaViews, uniqueMediaViews, clicks, likes] =
        await Promise.all([
          safeGraph(input.config, ref.external_post_id, {
            fields: "id,shares,comments.limit(0).summary(true)",
          }),
          insightMetric(
            input.config,
            `${ref.external_post_id}/insights`,
            "post_media_view",
            "lifetime",
          ),
          insightMetric(
            input.config,
            `${ref.external_post_id}/insights`,
            "post_total_media_view_unique",
            "lifetime",
          ),
          insightMetric(
            input.config,
            `${ref.external_post_id}/insights`,
            "post_clicks",
            "lifetime",
          ),
          insightMetric(
            input.config,
            `${ref.external_post_id}/insights`,
            "post_reactions_like_total",
            "lifetime",
          ),
        ]);

      const comments =
        typeof post?.comments === "object" && post.comments
          ? numeric(((post.comments as Json).summary as Json | undefined)?.total_count)
          : 0;
      const shares =
        typeof post?.shares === "object" && post.shares
          ? numeric((post.shares as Json).count)
          : 0;

      postSamples.push({
        postId: ref.post_id,
        platform: "facebook",
        capturedAt,
        externalSnapshotKey: `facebook:${ref.external_post_id}:${capturedAt.slice(0, 13)}`,
        impressions: mediaViews,
        reach: uniqueMediaViews,
        clicks,
        likes,
        comments,
        shares,
        metadata: {
          external_post_id: ref.external_post_id,
          external_account_id: ref.external_account_id || null,
          impression_semantics: "post_media_view",
          reach_semantics: "post_total_media_view_unique",
          meta_metric_generation: "2026_current",
        },
      });
    }
  }

  const accountSamples: SocialAccountMetricSample[] = [];

  if (input.config.instagramBusinessAccountId) {
    const accountId = input.config.instagramBusinessAccountId;
    const [profile, views, reach, interactions] = await Promise.all([
      graph(input.config, accountId, {
        fields: "followers_count,follows_count",
      }),
      insightMetric(
        input.config,
        `${accountId}/insights`,
        "views",
        "day",
        { metric_type: "total_value" },
      ),
      insightMetric(
        input.config,
        `${accountId}/insights`,
        "reach",
        "day",
        { metric_type: "total_value" },
      ),
      insightMetric(
        input.config,
        `${accountId}/insights`,
        "total_interactions",
        "day",
        { metric_type: "total_value" },
      ),
    ]);

    accountSamples.push({
      brandId: input.brandId,
      platform: "instagram",
      capturedAt,
      externalSnapshotKey: `instagram-account:${accountId}:${capturedAt.slice(0, 13)}`,
      followers: numeric(profile.followers_count),
      following: numeric(profile.follows_count),
      impressions: views,
      reach,
      engagements: interactions,
      metadata: {
        external_account_id: accountId,
        impression_semantics: "views",
        engagement_semantics: "total_interactions",
        meta_metric_generation: "2026_current",
      },
    });
  }

  if (input.config.pageId) {
    const pageId = input.config.pageId;
    const [page, mediaViews, uniqueMediaViews, engagements, profileViews] =
      await Promise.all([
        graph(input.config, pageId, { fields: "followers_count" }),
        insightMetric(
          input.config,
          `${pageId}/insights`,
          "page_media_view",
          "day",
        ),
        insightMetric(
          input.config,
          `${pageId}/insights`,
          "page_total_media_view_unique",
          "day",
        ),
        insightMetric(
          input.config,
          `${pageId}/insights`,
          "page_post_engagements",
          "day",
        ),
        insightMetric(
          input.config,
          `${pageId}/insights`,
          "page_views_total",
          "day",
        ),
      ]);

    accountSamples.push({
      brandId: input.brandId,
      platform: "facebook",
      capturedAt,
      externalSnapshotKey: `facebook-account:${pageId}:${capturedAt.slice(0, 13)}`,
      followers: numeric(page.followers_count),
      impressions: mediaViews,
      reach: uniqueMediaViews,
      engagements,
      profileViews,
      metadata: {
        external_account_id: pageId,
        impression_semantics: "page_media_view",
        reach_semantics: "page_total_media_view_unique",
        meta_metric_generation: "2026_current",
      },
    });
  }

  return { postSamples, accountSamples, capturedAt };
}

export async function metaConfigFromIntegration(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<MetaConfig> {
  const rpcClient = supabase as any;
  const [
    { data: credentials, error: credentialError },
    { data: integration, error: integrationError },
  ] = await Promise.all([
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
  if (integration?.status !== "connected") {
    throw new Error("Meta integration is not connected.");
  }

  const secret = (credentials || {}) as Json;
  const configuration = (integration?.configuration || {}) as Json;
  const accessToken =
    typeof secret.access_token === "string" ? secret.access_token : "";
  if (!accessToken) {
    throw new Error("Meta integration has no stored Page access token.");
  }

  return {
    accessToken,
    apiVersion:
      typeof configuration.api_version === "string"
        ? configuration.api_version
        : process.env.META_GRAPH_API_VERSION || "v24.0",
    pageId:
      typeof configuration.page_id === "string"
        ? configuration.page_id
        : undefined,
    instagramBusinessAccountId:
      typeof configuration.instagram_business_account_id === "string"
        ? configuration.instagram_business_account_id
        : undefined,
  };
}

export function metaConfigFromEnvironment(): MetaConfig {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(
      "META_ACCESS_TOKEN is not configured in the Trigger.dev environment.",
    );
  }

  return {
    accessToken,
    apiVersion: process.env.META_GRAPH_API_VERSION || "v24.0",
    pageId: process.env.META_PAGE_ID || undefined,
    instagramBusinessAccountId: process.env.META_IG_ACCOUNT_ID || undefined,
  };
}
