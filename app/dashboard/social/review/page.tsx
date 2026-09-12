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
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Fluxknight Social · Phase 3.6</p>
          <h1>Review & Approval</h1>
          <p>Review copy and creative together. Edits invalidate prior approval; only media-complete posts can be approved.</p>
        </div>
        <Link href="/dashboard/social/posts" className="admin-status">All posts</Link>
      </header>

      <section className="admin-panel">
        <div className="admin-list">
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
              <article key={post.id} className="admin-panel" style={{ marginBottom: 18 }}>
                <div className="admin-panel-header">
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

                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, .9fr)", gap: 22 }}>
                  <div>
                    <form action={updateSocialPostReviewAction} style={{ display: "grid", gap: 12 }}>
                      <input type="hidden" name="post_id" value={post.id} />
                      <label><span>Title</span><input style={inputStyle} name="title" defaultValue={post.title} /></label>
                      <label><span>Hook</span><textarea style={textareaStyle} name="hook" defaultValue={hook} /></label>
                      <label><span>Caption</span><textarea style={{ ...textareaStyle, minHeight: 180 }} name="caption" defaultValue={post.caption} /></label>
                      <label><span>CTA</span><input style={inputStyle} name="cta" defaultValue={cta} /></label>
                      <button type="submit" className="admin-status" style={{ cursor: "pointer", justifySelf: "start" }}>Save edits</button>
                    </form>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
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

                    <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
                      {post.status === "review" ? (
                        <form action={approveSocialPostReviewAction}>
                          <input type="hidden" name="post_id" value={post.id} />
                          <button type="submit" className={readiness.ready ? "admin-status live" : "admin-status warning"} style={{ cursor: readiness.ready ? "pointer" : "not-allowed" }} disabled={!readiness.ready}>Approve</button>
                          {!readiness.ready ? <p style={{ marginTop: 6 }}>{readiness.reason}</p> : null}
                        </form>
                      ) : <span className="admin-status live">Approved</span>}

                      <form action={rejectSocialPostReviewAction} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <input type="hidden" name="post_id" value={post.id} />
                        <textarea style={{ ...textareaStyle, minHeight: 76 }} name="reason" placeholder="What should change before approval?" required />
                        <button type="submit" className="admin-status warning" style={{ cursor: "pointer", whiteSpace: "nowrap" }}>Reject to draft</button>
                      </form>
                    </div>
                  </div>

                  <div>
                    <strong style={{ display: "block", marginBottom: 10 }}>Creative preview</strong>
                    {imageAsset && signedUrls.get(imageAsset.id) ? (
                      <img src={signedUrls.get(imageAsset.id)} alt={post.title} style={{ width: "100%", borderRadius: 14, border: "1px solid var(--admin-border, #2d2d35)" }} />
                    ) : null}
                    {carouselAssets.length ? (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                        {carouselAssets.map((asset, index) => signedUrls.get(asset.id) ? (
                          <div key={asset.id}>
                            <img src={signedUrls.get(asset.id)} alt={`${post.title} slide ${index + 1}`} style={{ width: "100%", borderRadius: 10, border: "1px solid var(--admin-border, #2d2d35)" }} />
                            <span>Slide {index + 1}</span>
                          </div>
                        ) : null)}
                      </div>
                    ) : null}
                    {videoAsset && signedUrls.get(videoAsset.id) ? (
                      <video controls preload="metadata" style={{ width: "100%", maxHeight: 640, borderRadius: 14, background: "#050507" }} src={signedUrls.get(videoAsset.id)} />
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
