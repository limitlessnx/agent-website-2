import Link from "next/link";
import { generateCarouselAction } from "@/app/dashboard/social/carousels/actions";
import { generateStaticGraphicAction } from "@/app/dashboard/social/graphics/actions";
import {
  approveSocialPostReviewAction,
  rejectSocialPostReviewAction,
  updateSocialPostReviewAction,
} from "@/app/dashboard/social/review/actions";
import { generateReelPlanAction, renderReelAction } from "@/app/dashboard/social/video/actions";
import { createSocialAssetSignedUrl, listSocialAssets } from "@/lib/social-assets";
import { getSocialReviewReadiness } from "@/lib/social-review";
import { listSocialPosts } from "@/lib/social";
import styles from "./review.module.css";

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--admin-border, #2d2d35)",
  background: "transparent",
  color: "inherit",
} as const;

const textareaStyle = { ...inputStyle, minHeight: 110, resize: "vertical" as const };

function contentString(content: Record<string, unknown>, key: string) {
  const value = content?.[key];
  return typeof value === "string" ? value : "";
}

export default async function SocialReviewPage() {
  const [allPosts, allAssets] = await Promise.all([listSocialPosts(200), listSocialAssets()]);
  const posts = allPosts.filter((post) => ["review", "approved"].includes(post.status));

  const assetsByPost = new Map<string, typeof allAssets>();
  for (const asset of allAssets) {
    if (!asset.post_id || asset.status !== "ready") continue;
    const current = assetsByPost.get(asset.post_id) || [];
    current.push(asset);
    assetsByPost.set(asset.post_id, current);
  }

  const signedUrls = new Map<string, string>();
  await Promise.all(
    allAssets
      .filter((asset) => asset.status === "ready" && asset.post_id)
      .map(async (asset) => {
        try {
          signedUrls.set(asset.id, await createSocialAssetSignedUrl(asset.id, 3600));
        } catch {
          // Keep review usable even if one preview URL cannot be generated.
        }
      }),
  );

  return (
    <main className={`admin-page ${styles.reviewPage}`}>
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Fluxknight Social · Phase 3.6</p>
          <h1>Review & Approval</h1>
          <p>Review copy and creative together. Edits invalidate prior approval; only media-complete posts can be approved.</p>
        </div>
        <Link href="/dashboard/social/posts" className="admin-status">All posts</Link>
      </header>

      <section className="admin-panel">
        <div className={`admin-list ${styles.reviewQueue}`}>
          {posts.map((post) => {
            const readiness = getSocialReviewReadiness(post);
            const postAssets = assetsByPost.get(post.id) || [];
            const hook = contentString(post.content, "hook");
            const cta = contentString(post.content, "cta");
            const rejection = typeof post.metadata?.review_rejection_reason === "string" ? post.metadata.review_rejection_reason : "";
            const carouselAssets = postAssets
              .filter((asset) => asset.asset_type === "carousel_slide")
              .sort((a, b) => Number(a.metadata?.position || 0) - Number(b.metadata?.position || 0));
            const videoAsset = postAssets.find((asset) => ["reel", "video"].includes(asset.asset_type));
            const imageAsset = postAssets.find((asset) => asset.id === post.metadata?.primary_asset_id || asset.asset_type === "image");
            const hasPlan = Boolean(post.metadata?.reel_plan);
            const renderStatus = String(post.metadata?.reel_render_status || "");

            return (
              <article key={post.id} className={`admin-panel ${styles.reviewCard}`}>
                <div className={`admin-panel-header ${styles.reviewHeader}`}>
                  <div>
                    <h2>{post.title || "Untitled post"}</h2>
                    <p>{post.format} · {post.platforms.join(", ")} · {post.status}</p>
                  </div>
                  <span className={readiness.ready ? "admin-status live" : "admin-status warning"}>
                    {readiness.ready ? "Creative ready" : "Creative incomplete"}
                  </span>
                </div>

                {rejection ? (
                  <div className="admin-list-row" style={{ marginBottom: 14 }}>
                    <div><strong>Previous rejection note</strong><span>{rejection}</span></div>
                    <em>revision</em>
                  </div>
                ) : null}

                <div className={styles.reviewLayout}>
                  <div className={styles.editorColumn}>
                    <form action={updateSocialPostReviewAction} className={styles.editorForm}>
                      <input type="hidden" name="post_id" value={post.id} />
                      <label className={styles.field}><span>Title</span><input className={styles.input} style={inputStyle} name="title" defaultValue={post.title} /></label>
                      <label className={styles.field}><span>Hook</span><textarea className={styles.textarea} style={textareaStyle} name="hook" defaultValue={hook} /></label>
                      <label className={styles.field}><span>Caption</span><textarea className={`${styles.textarea} ${styles.caption}`} style={{ ...textareaStyle, minHeight: 180 }} name="caption" defaultValue={post.caption} /></label>
                      <label className={styles.field}><span>CTA</span><input className={styles.input} style={inputStyle} name="cta" defaultValue={cta} /></label>
                      <button type="submit" className="admin-status" style={{ cursor: "pointer", justifySelf: "start" }}>Save edits</button>
                    </form>

                    <div className={styles.generationActions}>
                      {post.format === "image" ? (
                        <form action={generateStaticGraphicAction}>
                          <input type="hidden" name="post_id" value={post.id} />
                          <button type="submit" className="admin-status live" style={{ cursor: "pointer" }}>Regenerate graphic</button>
                        </form>
                      ) : null}
                      {post.format === "carousel" ? (
                        <form action={generateCarouselAction}>
                          <input type="hidden" name="post_id" value={post.id} />
                          <button type="submit" className="admin-status live" style={{ cursor: "pointer" }}>Regenerate carousel</button>
                        </form>
                      ) : null}
                      {["reel", "video"].includes(post.format) ? (
                        <>
                          <form action={generateReelPlanAction}>
                            <input type="hidden" name="post_id" value={post.id} />
                            <button type="submit" className="admin-status" style={{ cursor: "pointer" }}>{hasPlan ? "Regenerate storyboard" : "Generate storyboard"}</button>
                          </form>
                          {hasPlan ? (
                            <form action={renderReelAction}>
                              <input type="hidden" name="post_id" value={post.id} />
                              <button type="submit" className="admin-status live" style={{ cursor: "pointer" }}>{renderStatus === "ready" ? "Render new Reel" : renderStatus === "queued" ? "Render queued" : "Render Reel"}</button>
                            </form>
                          ) : null}
                        </>
                      ) : null}
                    </div>

                    <div className={styles.reviewActions}>
                      {post.status === "review" ? (
                        <form action={approveSocialPostReviewAction}>
                          <input type="hidden" name="post_id" value={post.id} />
                          <button type="submit" className={readiness.ready ? "admin-status live" : "admin-status warning"} style={{ cursor: readiness.ready ? "pointer" : "not-allowed" }} disabled={!readiness.ready}>Approve</button>
                          {!readiness.ready ? <p style={{ marginTop: 6 }}>{readiness.reason}</p> : null}
                        </form>
                      ) : <span className="admin-status live">Approved</span>}

                      <form action={rejectSocialPostReviewAction} className={styles.rejectForm}>
                        <input type="hidden" name="post_id" value={post.id} />
                        <textarea style={{ ...textareaStyle, minHeight: 76 }} name="reason" placeholder="What should change before approval?" required />
                        <button type="submit" className={`admin-status warning ${styles.rejectButton}`} style={{ cursor: "pointer" }}>Reject to draft</button>
                      </form>
                    </div>
                  </div>

                  <div className={styles.previewColumn}>
                    <strong className={styles.previewTitle}>Creative preview</strong>
                    {imageAsset && signedUrls.get(imageAsset.id) ? (
                      <img src={signedUrls.get(imageAsset.id)} alt={post.title} className={styles.previewMedia} />
                    ) : null}
                    {carouselAssets.length ? (
                      <div className={styles.carouselGrid}>
                        {carouselAssets.map((asset, index) => signedUrls.get(asset.id) ? (
                          <div key={asset.id} className={styles.carouselItem}>
                            <img src={signedUrls.get(asset.id)} alt={`${post.title} slide ${index + 1}`}  />
                            <span>Slide {index + 1}</span>
                          </div>
                        ) : null)}
                      </div>
                    ) : null}
                    {videoAsset && signedUrls.get(videoAsset.id) ? (
                      <video controls preload="metadata" className={styles.video} src={signedUrls.get(videoAsset.id)} />
                    ) : null}
                    {!imageAsset && !carouselAssets.length && !videoAsset ? (
                      <div className="admin-list-row"><div><strong>No final media yet</strong><span>Generate the creative before approval.</span></div><em>waiting</em></div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
          {!posts.length ? (
            <div className="admin-list-row"><div><strong>Review queue is empty</strong><span>AI-generated posts enter Review once created.</span></div><em>clear</em></div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
