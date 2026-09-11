import Link from "next/link";
import { scheduleSocialPostAction, transitionSocialPostAction } from "@/app/dashboard/social/actions";
import { generateStaticGraphicAction } from "@/app/dashboard/social/graphics/actions";
import { listSocialPosts, listSocialSchedules, type SocialPostStatus } from "@/lib/social";

const NEXT_ACTIONS: Partial<Record<SocialPostStatus, Array<{ status: SocialPostStatus; label: string }>>> = {
  idea: [{ status: "draft", label: "Move to draft" }],
  draft: [{ status: "review", label: "Send to review" }],
  review: [{ status: "draft", label: "Return to draft" }, { status: "approved", label: "Approve" }],
  approved: [{ status: "review", label: "Reopen review" }],
  scheduled: [{ status: "approved", label: "Unschedule" }],
  failed: [{ status: "approved", label: "Approve retry" }],
};

const inputStyle = { padding: "9px 11px", borderRadius: 9, border: "1px solid var(--admin-border, #2d2d35)", background: "transparent", color: "inherit" } as const;

function contentString(content: Record<string, unknown>, key: string) {
  const value = content?.[key];
  return typeof value === "string" ? value : "";
}

export default async function SocialPostsPage() {
  const [posts, schedules] = await Promise.all([listSocialPosts(200), listSocialSchedules(200)]);
  const scheduleByPost = new Map(schedules.map((schedule) => [schedule.post_id, schedule]));

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Fluxknight Social</p>
          <h1>Posts</h1>
          <p>Controlled lifecycle: draft → review → approved → scheduled → published. AI-generated Phase 3.1 plans enter review before anything can move toward publishing.</p>
        </div>
        <Link href="/dashboard/social/create" className="admin-status live">Create content</Link>
      </header>

      <section className="admin-panel">
        <div className="admin-list">
          {posts.map((post) => {
            const schedule = scheduleByPost.get(post.id);
            const hook = contentString(post.content, "hook");
            const pillar = contentString(post.content, "content_pillar");
            const objective = contentString(post.content, "objective");
            const creativeBrief = contentString(post.content, "creative_brief");
            const aiGenerated = post.metadata?.ai_generated === true;
            const hasPrimaryAsset = typeof post.metadata?.primary_asset_id === "string";
            const canGenerateStatic = post.format === "image" && ["draft", "review", "approved"].includes(post.status);

            return (
              <div key={post.id} className="admin-list-row" style={{ alignItems: "flex-start", gap: 18 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <strong>{post.title || "Untitled post"}</strong>
                    {aiGenerated ? <span className="admin-status">AI · Phase 3.1</span> : null}
                    {hasPrimaryAsset ? <span className="admin-status live">Graphic ready</span> : null}
                  </div>
                  <span>{post.format} · {post.platforms.join(", ")} · {post.caption ? `${post.caption.slice(0, 180)}${post.caption.length > 180 ? "…" : ""}` : "No caption yet"}</span>
                  {hook ? <span><strong>Hook:</strong> {hook}</span> : null}
                  {pillar || objective ? <span>{pillar ? `Pillar: ${pillar}` : ""}{pillar && objective ? " · " : ""}{objective ? `Objective: ${objective}` : ""}</span> : null}
                  {creativeBrief ? <span><strong>Creative brief:</strong> {creativeBrief}</span> : null}
                  {schedule ? <span>Scheduled: {new Date(schedule.scheduled_for).toLocaleString()} · {schedule.status}</span> : null}

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    {(NEXT_ACTIONS[post.status] || []).map((action) => (
                      <form key={action.status} action={transitionSocialPostAction}>
                        <input type="hidden" name="post_id" value={post.id} />
                        <input type="hidden" name="next_status" value={action.status} />
                        <button type="submit" className="admin-status" style={{ cursor: "pointer" }}>{action.label}</button>
                      </form>
                    ))}
                    {canGenerateStatic ? (
                      <form action={generateStaticGraphicAction}>
                        <input type="hidden" name="post_id" value={post.id} />
                        <button type="submit" className="admin-status live" style={{ cursor: "pointer" }}>
                          {hasPrimaryAsset ? "Regenerate graphic" : "Generate graphic"}
                        </button>
                      </form>
                    ) : null}
                  </div>

                  {post.status === "approved" ? (
                    <form action={scheduleSocialPostAction} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, alignItems: "center" }}>
                      <input type="hidden" name="post_id" value={post.id} />
                      <input style={inputStyle} type="datetime-local" name="scheduled_for" required />
                      <select style={inputStyle} name="timezone" defaultValue="Africa/Lagos">
                        <option value="Africa/Lagos">West Africa Time</option>
                        <option value="UTC">UTC</option>
                        <option value="Europe/London">London</option>
                        <option value="America/New_York">New York</option>
                        <option value="Asia/Dubai">Dubai</option>
                      </select>
                      <button type="submit" className="admin-status live" style={{ cursor: "pointer" }}>Schedule</button>
                    </form>
                  ) : null}
                </div>
                <em>{post.status}</em>
              </div>
            );
          })}
          {!posts.length ? <div className="admin-list-row"><div><strong>No social posts yet</strong><span>Create a draft or generate the first five-post AI weekly plan.</span></div><em>empty</em></div> : null}
        </div>
      </section>
    </main>
  );
}
