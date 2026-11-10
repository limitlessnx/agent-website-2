import Link from "next/link";
import { generateCarouselAction } from "@/app/dashboard/social/carousels/actions";
import { generateStaticGraphicAction } from "@/app/dashboard/social/graphics/actions";
import {
  approveSocialPostReviewAction,
  approveReelVoiceReviewAction,
  selectReelMusicAction,
  rejectSocialPostReviewAction,
  updateSocialPostReviewAction,
} from "@/app/dashboard/social/review/actions";
import { generateReelPlanAction, renderReelAction } from "@/app/dashboard/social/video/actions";
import { createSocialAssetSignedUrl, listSocialAssets } from "@/lib/social-assets";
import { getSocialReviewReadiness } from "@/lib/social-review";
import { listSocialPosts } from "@/lib/social";
import styles from "./review.module.css";
import { ReviewSubmitButton } from "./ReviewSubmitButton";
import { ReviewStatusRefresh } from "./ReviewStatusRefresh";

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
  const licensedTracks = allAssets.filter((asset) => asset.asset_type === "audio" && asset.status === "ready" && asset.metadata?.licensed_for_social_usage === true);

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
            const isReel = ["reel", "video"].includes(post.format);
            const voiceReviewStatus = String(post.metadata?.reel_voice_review_status || "pending");
            const musicReady = post.metadata?.reel_music_status === "ready";
            const voiceVerified = post.metadata?.reel_audio_verified === true;
            const narrationAssetIds = Array.isArray(post.metadata?.reel_narration_asset_ids)
              ? post.metadata.reel_narration_asset_ids.filter((id): id is string => typeof id === "string") : [];
            const renderError = typeof post.metadata?.reel_render_error === "string" ? post.metadata.reel_render_error : "";
            const isRendering = ["queued", "rendering"].includes(renderStatus);
            const voiceAssets = postAssets
              .filter((asset) => asset.asset_type === "audio" && narrationAssetIds.includes(asset.id))
              .sort((a, b) => Number(a.metadata?.scene_index || 0) - Number(b.metadata?.scene_index || 0));

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

                {isReel ? (
                  <div className={styles.productionOverview}>
                    <div className={styles.overviewHeading}>
                      <div><strong>Reel production</strong><p>Prepare the script, generate media, and review before publishing.</p></div>
                      <span className={styles.overviewState}>{isRendering ? "In progress" : renderError ? "Action needed" : readiness.ready ? "Ready to approve" : "In review"}</span>
                    </div>
                    <div className={styles.productionSteps} aria-label="Reel production stages">
                      <span className={hasPlan ? styles.stepComplete : styles.stepPending}>1. Storyboard</span>
                      <span className={renderStatus === "ready" && voiceVerified ? styles.stepComplete : isRendering ? styles.stepActive : styles.stepPending}>2. Render</span>
                      <span className={voiceReviewStatus === "approved" ? styles.stepComplete : styles.stepPending}>3. Audio review</span>
                      <span className={readiness.ready ? styles.stepComplete : styles.stepPending}>4. Approval</span>
                    </div>
                    {renderError ? (
                      <div className={styles.inlineAlert} role="alert">
                        <strong>Reel generation needs attention</strong>
                        <p>{renderError.includes("HTTP 402")
                          ? "ElevenLabs declined narration generation (HTTP 402). Check ElevenLabs billing, available credits and API access before trying again."
                          : renderError}</p>
                      </div>
                    ) : null}
                    {isRendering ? <div className={styles.progressControls}><p className={styles.progressMessage} role="status">Reel generation is {renderStatus}. You can check its progress here.</p><ReviewStatusRefresh /></div> : null}
                  </div>
                ) : null}
                <div className={styles.reviewLayout}>
                  <div className={styles.editorColumn}>
                    <details className={styles.workflowSection}>
                      <summary><span><strong>Content & copy</strong><small>Title, hook, caption and CTA</small></span></summary>
                    <form action={updateSocialPostReviewAction} className={styles.editorForm}>
                      <input type="hidden" name="post_id" value={post.id} />
                      <label className={styles.field}><span>Title</span><input className={styles.input} style={inputStyle} name="title" defaultValue={post.title} /></label>
                      <label className={styles.field}><span>Hook</span><textarea className={styles.textarea} style={textareaStyle} name="hook" defaultValue={hook} /></label>
                      <label className={styles.field}><span>Caption</span><textarea className={`${styles.textarea} ${styles.caption}`} style={{ ...textareaStyle, minHeight: 180 }} name="caption" defaultValue={post.caption} /></label>
                      <label className={styles.field}><span>CTA</span><input className={styles.input} style={inputStyle} name="cta" defaultValue={cta} /></label>
                      <ReviewSubmitButton pendingLabel="Saving edits…" kind="primary">Save edits</ReviewSubmitButton>
                    </form>
                    </details>

                    <section className={styles.productionActions} aria-label="Generate media">
                      <div className={styles.sectionHeading}><strong>Production actions</strong><span>Generate your creative before approving it.</span></div>
                    <div className={styles.generationActions}>
                      {post.format === "image" ? (
                        <form action={generateStaticGraphicAction}>
                          <input type="hidden" name="post_id" value={post.id} />
                          <ReviewSubmitButton kind="secondary" pendingLabel="Generating graphic…">Regenerate graphic</ReviewSubmitButton>
                        </form>
                      ) : null}
                      {post.format === "carousel" ? (
                        <form action={generateCarouselAction}>
                          <input type="hidden" name="post_id" value={post.id} />
                          <ReviewSubmitButton kind="secondary" pendingLabel="Generating carousel…">Regenerate carousel</ReviewSubmitButton>
                        </form>
                      ) : null}
                      {["reel", "video"].includes(post.format) ? (
                        <>
                          <form action={generateReelPlanAction}>
                            <input type="hidden" name="post_id" value={post.id} />
                            <ReviewSubmitButton kind="secondary" pendingLabel="Generating storyboard…">{hasPlan ? "Regenerate storyboard" : "Generate storyboard"}</ReviewSubmitButton>
                          </form>
                          {hasPlan ? (
                            <form action={renderReelAction}>
                              <input type="hidden" name="post_id" value={post.id} />
                              <ReviewSubmitButton kind="primary" disabled={isRendering} pendingLabel="Queueing Reel…">{renderStatus === "ready" ? "Render new Reel" : isRendering ? "Render in progress" : "Render Reel"}</ReviewSubmitButton>
                            </form>
                          ) : null}
                        </>
                      ) : null}
                    </div>

                    </section>

                    {isReel ? (
                      <details className={styles.workflowSection} open={Boolean(renderError)}>
                        <summary><span><strong>Voice & soundtrack</strong><small>Premium male · Captions off · {musicReady ? "Music ready" : "Music not selected"}</small></span></summary>
                      <form action={selectReelMusicAction} style={{ display: "grid", gap: 8, marginTop: 14 }}>
                        <input type="hidden" name="post_id" value={post.id} />
                        <label style={{ display: "grid", gap: 6 }}>
                          <strong>Background music (licensed tracks only)</strong>
                          <select name="music_asset_id" required style={inputStyle}
                            defaultValue={typeof post.metadata?.reel_music_asset_id === "string" ? post.metadata.reel_music_asset_id : ""}>
                            <option value="">Choose a licensed soundtrack</option>
                            {licensedTracks.filter((asset) => asset.brand_id === post.brand_id).map((asset) => (
                              <option key={asset.id} value={asset.id}>{asset.storage_path.split("/").pop() || asset.id}</option>
                            ))}
                          </select>
                        </label>
                        <ReviewSubmitButton pendingLabel="Saving soundtrack…">Save soundtrack</ReviewSubmitButton>
                        {!licensedTracks.length ? <span>Upload a rights-cleared music track in the Asset Library first.</span> : null}
                      </form>
                      </details>
                    ) : null}
                    {isReel && hasPlan ? (
                      <div className={styles.audioReviewCompact}>
                        <strong>Reel narration review · Premium male</strong>
                        <span>{voiceVerified ? "Audio verified in rendered MP4" : "Narration not yet verified"} · Captions off · {musicReady ? "Licensed background music ready" : "Licensed music missing"}</span>

                        <span>Listen to the voice clips on the right, then approve this specific narration. Regeneration resets approval.</span>
                        {voiceReviewStatus === "approved" ? (
                          <span className="admin-status live">Narration approved</span>
                        ) : (
                          <form action={approveReelVoiceReviewAction}>
                            <input type="hidden" name="post_id" value={post.id} />
                            <ReviewSubmitButton kind="primary" pendingLabel="Approving audio…" disabled={!voiceVerified || !musicReady || !voiceAssets.length || post.status !== "review"}>Approve narration and music</ReviewSubmitButton>
                          </form>
                        )}
                      </div>
                    ) : null}

                    <section className={styles.reviewActions} aria-label="Final approval">
                      <div className={styles.sectionHeading}><strong>Final approval</strong><span>No content is published automatically.</span></div>
                      {post.status === "review" ? (
                        <form action={approveSocialPostReviewAction}>
                          <input type="hidden" name="post_id" value={post.id} />
                          <ReviewSubmitButton kind="primary" disabled={!readiness.ready} pendingLabel="Approving post…">Approve post</ReviewSubmitButton>
                          {!readiness.ready ? <p style={{ marginTop: 6 }}>{readiness.reason}</p> : null}
                        </form>
                      ) : <span className="admin-status live">Approved</span>}

                      <form action={rejectSocialPostReviewAction} className={styles.rejectForm}>
                        <input type="hidden" name="post_id" value={post.id} />
                        <textarea style={{ ...textareaStyle, minHeight: 76 }} name="reason" placeholder="What should change before approval?" required />
                        <ReviewSubmitButton kind="danger" className={styles.rejectButton} pendingLabel="Returning to draft…">Return to draft</ReviewSubmitButton>
                      </form>
                    </section>
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
                    {isReel && voiceAssets.length ? (
                      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
                        <strong>Voice previews</strong>
                        {voiceAssets.map((asset, index) => signedUrls.get(asset.id) ? (
                          <div key={asset.id} style={{ display: "grid", gap: 5 }}>
                            <span>Scene {Number(asset.metadata?.scene_index ?? index) + 1} · Premium male</span>
                            <audio controls preload="none" src={signedUrls.get(asset.id)} style={{ width: "100%" }} />
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
