import Link from "next/link";
import { getSocialAnalyticsSnapshot } from "@/lib/social-analytics";
import { listSocialPosts } from "@/lib/social";

const number = new Intl.NumberFormat("en-US");
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default async function SocialAnalyticsPage() {
  const [{ summary, latestPostMetrics, latestAccountMetrics }, posts] = await Promise.all([
    getSocialAnalyticsSnapshot(),
    listSocialPosts(300),
  ]);

  const postById = new Map(posts.map((post) => [post.id, post]));
  const ranked = [...latestPostMetrics]
    .map((metric) => ({
      metric,
      score: Number(metric.likes || 0) + Number(metric.comments || 0) + Number(metric.shares || 0) + Number(metric.saves || 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Fluxknight Social · Phase 3.7</p>
          <h1>Analytics</h1>
          <p>Performance storage is live now. Platform APIs can feed these same snapshots later without rebuilding the analytics layer.</p>
        </div>
        <Link href="/dashboard/social/review" className="admin-status">Review queue</Link>
      </header>

      <section className="admin-grid two">
        <div className="admin-panel compact"><strong>{number.format(summary.impressions)}</strong><p>Impressions</p></div>
        <div className="admin-panel compact"><strong>{number.format(summary.reach)}</strong><p>Reach</p></div>
        <div className="admin-panel compact"><strong>{number.format(summary.engagements)}</strong><p>Engagements</p></div>
        <div className="admin-panel compact"><strong>{summary.engagementRate.toFixed(2)}%</strong><p>Engagement rate</p></div>
        <div className="admin-panel compact"><strong>{number.format(summary.clicks)}</strong><p>Clicks</p></div>
        <div className="admin-panel compact"><strong>{summary.clickThroughRate.toFixed(2)}%</strong><p>CTR</p></div>
        <div className="admin-panel compact"><strong>{number.format(summary.conversions)}</strong><p>Conversions</p></div>
        <div className="admin-panel compact"><strong>{money.format(summary.revenueAttributed)}</strong><p>Attributed revenue</p></div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Top content</h2><p>Uses the latest snapshot for each post/platform so cumulative platform counters are not accidentally double-counted.</p></div>
        </div>
        <div className="admin-list">
          {ranked.map(({ metric, score }) => {
            const post = postById.get(metric.post_id);
            return (
              <div key={`${metric.post_id}:${metric.platform}`} className="admin-list-row">
                <div>
                  <strong>{post?.title || "Untitled post"}</strong>
                  <span>{metric.platform} · {number.format(metric.impressions)} impressions · {number.format(score)} engagements · {number.format(metric.clicks)} clicks</span>
                </div>
                <em>{new Date(metric.captured_at).toLocaleDateString()}</em>
              </div>
            );
          })}
          {!ranked.length ? (
            <div className="admin-list-row">
              <div><strong>No performance snapshots yet</strong><span>The dashboard is ready. Real platform metrics will populate here when connectors resume, and imports/manual snapshots can use the same schema.</span></div>
              <em>waiting for data</em>
            </div>
          ) : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Account snapshots</h2><p>Latest audience and account-level state by platform.</p></div>
        </div>
        <div className="admin-list">
          {latestAccountMetrics.map((metric) => (
            <div key={`${metric.brand_id}:${metric.platform}`} className="admin-list-row">
              <div><strong>{metric.platform}</strong><span>{number.format(metric.followers)} followers · {number.format(metric.profile_views)} profile views · {number.format(metric.website_clicks)} website clicks</span></div>
              <em>{metric.source}</em>
            </div>
          ))}
          {!latestAccountMetrics.length ? <div className="admin-list-row"><div><strong>No account snapshots yet</strong><span>Phase 2 platform connectors can write here later without changing the dashboard contract.</span></div><em>empty</em></div> : null}
        </div>
      </section>
    </main>
  );
}
