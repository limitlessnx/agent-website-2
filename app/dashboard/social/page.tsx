import Link from "next/link";
import { getSocialBrand, listSocialPosts, listSocialPublishJobs, listSocialSchedules } from "@/lib/social";

export default async function SocialOverviewPage() {
  const [brand, posts, schedules, jobs] = await Promise.all([
    getSocialBrand(),
    listSocialPosts(100),
    listSocialSchedules(100),
    listSocialPublishJobs(100),
  ]);

  const scheduled = posts.filter((post) => post.status === "scheduled").length;
  const published = posts.filter((post) => post.status === "published").length;
  const reviewCount = posts.filter((post) => post.status === "review").length;
  const failedJobs = jobs.filter((job) => job.status === "failed").length;

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Fluxknight Social</p>
          <h1>Social AI Control Center</h1>
          <p>Plan, review, approve, measure, schedule and publish branded content through one tenant-safe pipeline.</p>
        </div>
        <span className={failedJobs ? "admin-status warning" : "admin-status live"}>
          {failedJobs ? `${failedJobs} publish issue${failedJobs === 1 ? "" : "s"}` : "Publishing healthy"}
        </span>
      </header>

      <section className="admin-grid two">
        <div className="admin-panel compact"><strong>{posts.length}</strong><p>Total posts</p></div>
        <div className="admin-panel compact"><strong>{reviewCount}</strong><p>Awaiting review</p></div>
        <div className="admin-panel compact"><strong>{scheduled}</strong><p>Scheduled</p></div>
        <div className="admin-panel compact"><strong>{published}</strong><p>Published</p></div>
      </section>

      <section className="admin-grid two">
        <Link href="/dashboard/social/create" className="admin-panel compact">
          <div className="admin-panel-header"><div><h2>Create</h2><p>Draft a post or generate this week's AI content plan.</p></div></div>
        </Link>
        <Link href="/dashboard/social/review" className="admin-panel compact">
          <div className="admin-panel-header"><div><h2>Review & Approval</h2><p>Preview copy and media together, edit, reject, regenerate or approve.</p></div><span className={reviewCount ? "admin-status warning" : "admin-status live"}>{reviewCount}</span></div>
        </Link>
        <Link href="/dashboard/social/analytics" className="admin-panel compact">
          <div className="admin-panel-header"><div><h2>Analytics</h2><p>Track post performance, account growth, conversion and attributed revenue.</p></div><span className="admin-status">3.7</span></div>
        </Link>
        <Link href="/dashboard/social/posts" className="admin-panel compact">
          <div className="admin-panel-header"><div><h2>Posts</h2><p>Inspect the complete content lifecycle and status history.</p></div></div>
        </Link>
        <Link href="/dashboard/social/calendar" className="admin-panel compact">
          <div className="admin-panel-header"><div><h2>Calendar</h2><p>Schedule approved posts and inspect publishing state.</p></div></div>
        </Link>
        <Link href="/dashboard/social/brand" className="admin-panel compact">
          <div className="admin-panel-header"><div><h2>Brand Brain</h2><p>Control voice, audience, pillars, products and CTAs.</p></div></div>
        </Link>
        <Link href="/dashboard/social/assets" className="admin-panel compact">
          <div className="admin-panel-header"><div><h2>Asset Library</h2><p>Private Supabase media storage for graphics, carousels, reels and audio.</p></div></div>
        </Link>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Brand Brain</h2><p>The context future content agents inherit before generating anything.</p></div>
        </div>
        {brand ? (
          <div className="admin-list">
            <div className="admin-list-row"><div><strong>{brand.name}</strong><span>{brand.tone}</span></div><em>active</em></div>
            <div className="admin-list-row"><div><strong>Audience</strong><span>{brand.audience}</span></div><em>{brand.content_pillars.length} pillars</em></div>
          </div>
        ) : <p>No Social Brand is configured for this organization.</p>}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Upcoming queue</h2><p>Next scheduled items waiting for Trigger.dev.</p></div></div>
        <div className="admin-list">
          {schedules.filter((schedule) => schedule.status === "pending").slice(0, 5).map((schedule) => {
            const post = posts.find((candidate) => candidate.id === schedule.post_id);
            return <div key={schedule.id} className="admin-list-row"><div><strong>{post?.title || "Untitled post"}</strong><span>{new Date(schedule.scheduled_for).toLocaleString()} · {post?.platforms.join(", ")}</span></div><em>{schedule.status}</em></div>;
          })}
          {!schedules.some((schedule) => schedule.status === "pending") ? <div className="admin-list-row"><div><strong>No pending posts</strong><span>Approve and schedule a draft to populate the queue.</span></div><em>empty</em></div> : null}
        </div>
      </section>
    </main>
  );
}
