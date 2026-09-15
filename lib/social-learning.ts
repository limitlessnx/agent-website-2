import type { SupabaseClient } from "@supabase/supabase-js";

export type SocialLearningStatus = "ready" | "insufficient_data" | "failed";

type MetricRow = {
  post_id: string;
  platform: string;
  captured_at: string;
  impressions: number | null;
  reach: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  clicks: number | null;
  conversions: number | null;
  revenue_attributed: number | string | null;
};

type PostRow = {
  id: string;
  title: string;
  format: string;
  platforms: string[] | null;
  content: Record<string, unknown> | null;
  published_at: string | null;
  created_at: string;
};

type ScoredMetric = {
  postId: string;
  platform: string;
  title: string;
  format: string;
  pillar: string;
  hook: string;
  engagements: number;
  impressions: number;
  reach: number;
  views: number;
  clicks: number;
  conversions: number;
  revenue: number;
  engagementRate: number;
  clickRate: number;
  conversionRate: number;
  qualityScore: number;
};

const n = (value: unknown) => Number(value || 0);
const round = (value: number, digits = 4) => Number(value.toFixed(digits));
const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

function latestByPostPlatform(rows: MetricRow[]) {
  const latest = new Map<string, MetricRow>();
  for (const row of rows) {
    const key = `${row.post_id}:${row.platform}`;
    if (!latest.has(key)) latest.set(key, row);
  }
  return [...latest.values()];
}

function groupSummary(rows: ScoredMetric[], keyOf: (row: ScoredMetric) => string) {
  const groups = new Map<string, ScoredMetric[]>();
  for (const row of rows) {
    const key = keyOf(row) || "unknown";
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([key, items]) => ({
      key,
      sample_count: items.length,
      avg_engagement_rate: round(items.reduce((sum, item) => sum + item.engagementRate, 0) / Math.max(items.length, 1)),
      avg_click_rate: round(items.reduce((sum, item) => sum + item.clickRate, 0) / Math.max(items.length, 1)),
      total_clicks: items.reduce((sum, item) => sum + item.clicks, 0),
      total_conversions: items.reduce((sum, item) => sum + item.conversions, 0),
      revenue_attributed: round(items.reduce((sum, item) => sum + item.revenue, 0), 2),
      avg_quality_score: round(items.reduce((sum, item) => sum + item.qualityScore, 0) / Math.max(items.length, 1)),
    }))
    .sort((a, b) => b.avg_quality_score - a.avg_quality_score);
}

function hookOpening(hook: string) {
  return hook
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(" ");
}

function repetitionSummary(posts: PostRow[]) {
  const pillarCounts = new Map<string, number>();
  const openingCounts = new Map<string, number>();
  for (const post of posts) {
    const content = post.content || {};
    const pillar = String(content.content_pillar || "").trim();
    const hook = String(content.hook || "").trim();
    if (pillar) pillarCounts.set(pillar, (pillarCounts.get(pillar) || 0) + 1);
    const opening = hookOpening(hook);
    if (opening) openingCounts.set(opening, (openingCounts.get(opening) || 0) + 1);
  }
  return {
    overused_pillars: [...pillarCounts.entries()]
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .map(([pillar, count]) => ({ pillar, count })),
    repeated_hook_openings: [...openingCounts.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([opening, count]) => ({ opening, count })),
  };
}

export async function buildSocialLearningSnapshot(input: {
  supabase: SupabaseClient;
  organizationId: string;
  brandId: string;
  sourceWeeklyRunId?: string | null;
  lookbackDays?: number;
}) {
  const lookbackDays = Math.max(14, Math.min(input.lookbackDays || 56, 180));
  const periodEndDate = new Date();
  const periodStartDate = new Date(periodEndDate.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const periodStart = dateOnly(periodStartDate);
  const periodEnd = dateOnly(periodEndDate);

  const { data: postsData, error: postsError } = await input.supabase
    .from("social_posts")
    .select("id,title,format,platforms,content,published_at,created_at")
    .eq("organization_id", input.organizationId)
    .eq("brand_id", input.brandId)
    .gte("created_at", periodStartDate.toISOString())
    .order("created_at", { ascending: false })
    .limit(250);
  if (postsError) throw postsError;
  const posts = (postsData || []) as PostRow[];
  const postMap = new Map(posts.map((post) => [post.id, post]));
  const postIds = posts.map((post) => post.id);

  let metricRows: MetricRow[] = [];
  if (postIds.length > 0) {
    const { data, error } = await input.supabase
      .from("social_post_metrics")
      .select("post_id,platform,captured_at,impressions,reach,views,likes,comments,shares,saves,clicks,conversions,revenue_attributed")
      .eq("organization_id", input.organizationId)
      .in("post_id", postIds)
      .gte("captured_at", periodStartDate.toISOString())
      .order("captured_at", { ascending: false })
      .limit(3000);
    if (error) throw error;
    metricRows = (data || []) as MetricRow[];
  }

  const latestMetrics = latestByPostPlatform(metricRows);
  const scored: ScoredMetric[] = latestMetrics.flatMap((metric) => {
    const post = postMap.get(metric.post_id);
    if (!post) return [];
    const content = post.content || {};
    const impressions = n(metric.impressions);
    const reach = n(metric.reach);
    const views = n(metric.views);
    const engagements = n(metric.likes) + n(metric.comments) + n(metric.shares) + n(metric.saves);
    const clicks = n(metric.clicks);
    const conversions = n(metric.conversions);
    const denominator = Math.max(reach, impressions, views, 1);
    const engagementRate = engagements / denominator;
    const clickRate = clicks / denominator;
    const conversionRate = conversions / denominator;
    const qualityScore = engagementRate * 100 + clickRate * 150 + conversionRate * 300;
    return [{
      postId: metric.post_id,
      platform: metric.platform,
      title: post.title,
      format: post.format,
      pillar: String(content.content_pillar || "unknown"),
      hook: String(content.hook || ""),
      engagements,
      impressions,
      reach,
      views,
      clicks,
      conversions,
      revenue: n(metric.revenue_attributed),
      engagementRate,
      clickRate,
      conversionRate,
      qualityScore,
    }];
  });

  const platformSummary = groupSummary(scored, (row) => row.platform).map(({ key, ...rest }) => ({ platform: key, ...rest }));
  const formatSummary = groupSummary(scored, (row) => row.format).map(({ key, ...rest }) => ({ format: key, ...rest }));
  const pillarSummary = groupSummary(scored, (row) => row.pillar).map(({ key, ...rest }) => ({ pillar: key, ...rest }));
  const ranked = [...scored].sort((a, b) => b.qualityScore - a.qualityScore);
  const winners = ranked.slice(0, 5).map((row) => ({
    post_id: row.postId,
    platform: row.platform,
    title: row.title,
    hook: row.hook,
    format: row.format,
    pillar: row.pillar,
    engagement_rate: round(row.engagementRate),
    click_rate: round(row.clickRate),
    conversions: row.conversions,
    quality_score: round(row.qualityScore),
  }));
  const underperformers = ranked.length >= 5
    ? ranked.slice(-Math.min(5, Math.ceil(ranked.length / 3))).reverse().map((row) => ({
        post_id: row.postId,
        platform: row.platform,
        title: row.title,
        hook: row.hook,
        format: row.format,
        pillar: row.pillar,
        engagement_rate: round(row.engagementRate),
        click_rate: round(row.clickRate),
        conversions: row.conversions,
        quality_score: round(row.qualityScore),
      }))
    : [];
  const hookSummary = winners.map((winner, index) => ({ rank: index + 1, ...winner }));
  const angleRepetition = repetitionSummary(posts);
  const status: SocialLearningStatus = scored.length >= 3 ? "ready" : "insufficient_data";

  const recommendations: string[] = [];
  if (status === "insufficient_data") {
    recommendations.push("Performance evidence is still sparse. Keep Brand Brain and recent-content diversity as the primary planning signals until at least three post-platform metric samples exist.");
    recommendations.push("Do not label any format, hook, pillar or platform a winner yet; collect real post metrics first.");
  } else {
    if (formatSummary[0]) recommendations.push(`Test another variation of the strongest observed format (${formatSummary[0].format}) without copying the previous creative.`);
    if (pillarSummary[0]) recommendations.push(`Keep the strongest observed pillar (${pillarSummary[0].pillar}) in the mix, but approach it from a new business situation or mechanism.`);
    if (platformSummary[0]) recommendations.push(`Use ${platformSummary[0].platform} performance as a platform-specific signal rather than assuming the same creative works equally everywhere.`);
  }
  if (angleRepetition.overused_pillars.length > 0) recommendations.push(`Reduce repetition around overused pillars: ${angleRepetition.overused_pillars.map((item) => item.pillar).join(", ")}.`);
  if (angleRepetition.repeated_hook_openings.length > 0) recommendations.push("Vary hook openings; recent posts are starting with recognizably similar language.");

  const dataQuality = {
    status,
    lookback_days: lookbackDays,
    post_sample_count: posts.length,
    metric_sample_count: scored.length,
    minimum_metric_samples_for_winner_claims: 3,
    has_platform_comparison: new Set(scored.map((row) => row.platform)).size >= 2,
    note: status === "ready" ? "Recommendations are derived from stored metrics." : "No performance winner claims should be made until more real metrics exist.",
  };

  const snapshotPayload = {
    organization_id: input.organizationId,
    brand_id: input.brandId,
    source_weekly_run_id: input.sourceWeeklyRunId || null,
    period_start: periodStart,
    period_end: periodEnd,
    status,
    post_sample_count: posts.length,
    metric_sample_count: scored.length,
    platform_summary: platformSummary,
    format_summary: formatSummary,
    pillar_summary: pillarSummary,
    hook_summary: hookSummary,
    angle_repetition: angleRepetition,
    winners,
    underperformers: underperformers,
    recommendations,
    data_quality: dataQuality,
    generated_at: new Date().toISOString(),
  };

  const { data: snapshot, error: snapshotError } = await input.supabase
    .from("social_learning_snapshots")
    .upsert(snapshotPayload, { onConflict: "organization_id,brand_id,period_start,period_end" })
    .select("*")
    .single();
  if (snapshotError) throw snapshotError;

  const { data: brand, error: brandError } = await input.supabase
    .from("social_brands")
    .select("visual_rules")
    .eq("organization_id", input.organizationId)
    .eq("id", input.brandId)
    .single();
  if (brandError) throw brandError;

  const visualRules = brand?.visual_rules && typeof brand.visual_rules === "object" ? brand.visual_rules as Record<string, unknown> : {};
  const learningMemory = {
    snapshot_id: snapshot.id,
    generated_at: snapshot.generated_at,
    status,
    data_quality: dataQuality,
    winning_hooks: hookSummary,
    best_formats: formatSummary.slice(0, 5),
    platform_differences: platformSummary.slice(0, 6),
    content_pillar_results: pillarSummary.slice(0, 8),
    repeated_angles: angleRepetition,
    recommendations,
    planner_instruction: status === "ready"
      ? "Use these measured performance signals as evidence, not commandments. Reuse successful mechanisms through fresh angles, diversify repeated themes, and never invent performance claims."
      : "Performance data is insufficient. Do not invent winners. Prioritize Brand Brain, recent-content diversity, and collecting real metrics.",
  };
  const { error: brandUpdateError } = await input.supabase
    .from("social_brands")
    .update({ visual_rules: { ...visualRules, learning_memory: learningMemory } })
    .eq("organization_id", input.organizationId)
    .eq("id", input.brandId);
  if (brandUpdateError) throw brandUpdateError;

  return snapshot;
}
