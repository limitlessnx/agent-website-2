import Link from "next/link";
import { listSocialPosts, listSocialPublishJobs, listSocialSchedules } from "@/lib/social";

export default async function SocialCalendarPage() {
  const [posts, schedules, jobs] = await Promise.all([
    listSocialPosts(250),
    listSocialSchedules(250),
    listSocialPublishJobs(500),
  ]);
  const postById = new Map(posts.map((post) => [post.id, post]));

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Fluxknight Social</p>
          <h1>Publishing calendar</h1>
          <p>Scheduled posts, Trigger.dev queue state and platform-level publish results.</p>
        </div>
        <Link href="/dashboard/social/posts" className="admin-status">Manage posts</Link>
      </header>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Schedule</h2><p>Times are stored as UTC while preserving the requested timezone.</p></div></div>
        <div className="admin-list">
          {schedules.map((schedule) => {
            const post = postById.get(schedule.post_id);
            const scheduleJobs = jobs.filter((job) => job.schedule_id === schedule.id);
            return (
              <div key={schedule.id} className="admin-list-row" style={{ alignItems: "flex-start" }}>
                <div>
                  <strong>{post?.title || "Unknown post"}</strong>
                  <span>{new Date(schedule.scheduled_for).toLocaleString()} · {schedule.timezone}</span>
                  <span>{post?.platforms.join(", ") || "No platforms"}</span>
                  {scheduleJobs.length ? <span>Jobs: {scheduleJobs.map((job) => `${job.platform} ${job.status}`).join(" · ")}</span> : <span>Jobs will be created when the schedule becomes due.</span>}
                  {schedule.last_error ? <span>Last error: {schedule.last_error}</span> : null}
                </div>
                <em>{schedule.status}</em>
              </div>
            );
          })}
          {!schedules.length ? <div className="admin-list-row"><div><strong>Calendar empty</strong><span>Approved posts can be scheduled from the Posts page.</span></div><em>empty</em></div> : null}
        </div>
      </section>
    </main>
  );
}
