import Link from "next/link";
import { ReviewSubmitButton } from "@/app/dashboard/social/review/ReviewSubmitButton";
import styles from "./posts.module.css";
import { scheduleSocialPostAction, transitionSocialPostAction } from "@/app/dashboard/social/actions";
import { generateCarouselAction } from "@/app/dashboard/social/carousels/actions";
import { generateStaticGraphicAction } from "@/app/dashboard/social/graphics/actions";
import { generateReelPlanAction, renderReelAction } from "@/app/dashboard/social/video/actions";
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
    <main className={`admin-page ${styles.postsPage}`}>
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Fluxknight Social</p>
          <h1>Posts</h1>
          <p>Controlled lifecycle: draft → review → approved → scheduled → published. AI-generated plans enter review before anything can move toward publishing.</p>
        </div>
        <Link href="/dashboard/social/create" className="admin-status live">Create content</Link>
      </header>

      <section className={styles.postsSection}>
        <div className={styles.postsList}>
          {posts.map((post) => {
            const schedule = scheduleByPost.get(post.id);
            const hook = contentString(post.content, "hook");
            const pillar = contentString(post.content, "content_pillar");
            const objective = contentString(post.content, "objective");
            const creativeBrief = contentString(post.content, "creative_brief");
            const aiGenerated = post.metadata?.ai_generated === true;
            const hasPrimaryAsset = typeof post.metadata?.primary_asset_id === "string";
            const carouselAssetIds = Array.isArray(post.metadata?.carousel_asset_ids) ? post.metadata.carousel_asset_ids : [];
            const canGenerateStatic = post.format === "image" && ["draft", "review", "approved"].includes(post.status);
            const canGenerateCarousel = post.format === "carousel" && ["draft", "review", "approved"].includes(post.status);
            const canGenerateReel = ["reel", "video"].includes(post.format) && ["draft", "review", "approved"].includes(post.status);
            const hasReelPlan = Boolean(post.metadata?.reel_plan);
            const reelRenderStatus = typeof post.metadata?.reel_render_status === "string" ? post.metadata.reel_render_status : "";
            const reelReady = typeof post.metadata?.reel_asset_id === "string" && reelRenderStatus === "ready";

            return (
              <article key={post.id} className={styles.postCard}>
                <div className={styles.postBody}>
                  <div className={styles.cardHeading}>
                    <strong className={styles.postTitle}>{post.title || "Untitled post"}</strong>
                    {aiGenerated ? <span className={styles.metaBadge}>AI-assisted</span> : null}
                    {post.format === "carousel" && carouselAssetIds.length ? <span className={styles.statusSuccess}>Carousel ready · {carouselAssetIds.length} slides</span> : null}
                    {post.format === "image" && hasPrimaryAsset ? <span className={styles.statusSuccess}>Graphic ready</span> : null}
                    {canGenerateReel && hasReelPlan ? <span className={styles.metaBadge}>Storyboard ready</span> : null}
                    {canGenerateReel && reelRenderStatus === "queued" ? <span className={styles.metaBadge}>Reel queued</span> : null}
                    {canGenerateReel && reelReady ? <span className={styles.statusSuccess}>Reel ready</span> : null}
                  </div>
                  <p className={styles.postMeta}>{post.format} · {post.platforms.join(", ")} · <span className={styles.postState}>{post.status}</span></p>
                  <p className={styles.captionPreview}>{post.caption ? `${post.caption.slice(0, 150)}${post.caption.length > 150 ? "…" : ""}` : "No caption yet"}</p>
                  {schedule ? <p className={styles.postMeta}>Scheduled: {new Date(schedule.scheduled_for).toLocaleString()} · {schedule.status}</p> : null}
                  {(hook || pillar || objective || creativeBrief) ? (
                    <details className={styles.postDetails}>
                      <summary>View content brief</summary>
                      <div className={styles.detailsContent}>
                        {hook ? <p><strong>Hook:</strong> {hook}</p> : null}
                        {pillar || objective ? <p>{pillar ? `Pillar: ${pillar}` : ""}{pillar && objective ? " · " : ""}{objective ? `Objective: ${objective}` : ""}</p> : null}
                        {creativeBrief ? <p><strong>Creative brief:</strong> {creativeBrief}</p> : null}
                      </div>
                    </details>
                  ) : null}
                  <div className={styles.actions} aria-label={`Actions for ${post.title || "post"}`}>

                    {(NEXT_ACTIONS[post.status] || []).map((action) => (
                      <form key={action.status} action={transitionSocialPostAction}>
                        <input type="hidden" name="post_id" value={post.id} />
                        <input type="hidden" name="next_status" value={action.status} />
                        <ReviewSubmitButton kind="secondary" pendingLabel="Updating post…">{action.label}</ReviewSubmitButton>
                      </form>
                    ))}
                    {canGenerateStatic ? (
                      <form action={generateStaticGraphicAction}>
                        <input type="hidden" name="post_id" value={post.id} />
                        <ReviewSubmitButton kind="primary" pendingLabel="Generating graphic…">{hasPrimaryAsset ? "Regenerate graphic" : "Generate graphic"}</ReviewSubmitButton>
                      </form>
                    ) : null}
                    {canGenerateCarousel ? (
                      <form action={generateCarouselAction}>
                        <input type="hidden" name="post_id" value={post.id} />
                        <ReviewSubmitButton kind="primary" pendingLabel="Generating carousel…">{carouselAssetIds.length ? "Regenerate carousel" : "Generate carousel"}</ReviewSubmitButton>
                      </form>
                    ) : null}
                    {canGenerateReel ? (
                      <>
                        <form action={generateReelPlanAction}>
                          <input type="hidden" name="post_id" value={post.id} />
                          <ReviewSubmitButton kind={hasReelPlan ? "secondary" : "primary"} pendingLabel="Generating storyboard…">{hasReelPlan ? "Regenerate storyboard" : "Generate storyboard"}</ReviewSubmitButton>
                        </form>
                        {hasReelPlan ? (
                          <form action={renderReelAction}>
                            <input type="hidden" name="post_id" value={post.id} />
                            <ReviewSubmitButton kind="primary" disabled={reelRenderStatus === "queued" || reelRenderStatus === "rendering"} pendingLabel="Queueing Reel…">{reelReady ? "Render again" : ["queued", "rendering"].includes(reelRenderStatus) ? "Render in progress" : "Render Reel"}</ReviewSubmitButton>
                          </form>
                        ) : null}
                      </>
                    ) : null}
                  </div>

                  {post.status === "approved" ? (
                    <form action={scheduleSocialPostAction} className={styles.scheduleForm}>
                      <input type="hidden" name="post_id" value={post.id} />
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                        {post.platforms.includes("facebook") ? (
                          <span className="admin-status">
                            Facebook handled by Instagram auto-share
                          </span>
                        ) : null}
                        {post.platforms.includes("instagram") ? (
                          <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                            <input type="checkbox" name="publish_platforms" value="instagram" defaultChecked />
                            <span>Instagram</span>
                          </label>
                        ) : null}
                        {post.platforms.includes("linkedin") ? (
                          <span className="admin-status">LinkedIn publishing not connected yet</span>
                        ) : null}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        <input style={inputStyle} type="datetime-local" name="scheduled_for" required />
                        <select style={inputStyle} name="timezone" defaultValue="Africa/Lagos">
                          <option value="Africa/Lagos">West Africa Time</option>
                          <option value="UTC">UTC</option>
                          <option value="Europe/London">London</option>
                          <option value="America/New_York">New York</option>
                          <option value="Asia/Dubai">Dubai</option>
                        </select>
                        <ReviewSubmitButton kind="primary" pendingLabel="Scheduling…">Schedule Instagram publish</ReviewSubmitButton>
                      </div>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })}
          {!posts.length ? <div className="admin-list-row"><div><strong>No social posts yet</strong><span>Create a draft or generate the first five-post AI weekly plan.</span></div><em>empty</em></div> : null}
        </div>
      </section>
    </main>
  );
}
