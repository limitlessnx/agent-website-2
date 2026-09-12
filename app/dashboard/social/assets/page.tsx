import Link from "next/link";
import { uploadSocialAssetAction } from "@/app/dashboard/social/assets/actions";
import { listSocialAssets } from "@/lib/social-assets";
import { listSocialPosts } from "@/lib/social";

const inputStyle = { width: "100%", padding: "11px 13px", borderRadius: 10, border: "1px solid var(--admin-border, #2d2d35)", background: "transparent", color: "inherit" } as const;

function formatBytes(value: number | null) {
  if (value == null) return "Unknown size";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function SocialAssetsPage() {
  const [assets, posts] = await Promise.all([listSocialAssets(), listSocialPosts(200)]);
  const postById = new Map(posts.map((post) => [post.id, post]));

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Fluxknight Social · Phase 3.2</p>
          <h1>Asset Library</h1>
          <p>Media is stored in private Supabase Storage. Vercel is execution only and never the persistent media store.</p>
        </div>
        <Link href="/dashboard/social" className="admin-status">Back to Social</Link>
      </header>

      <section className="admin-grid two">
        <div className="admin-panel compact"><strong>{assets.length}</strong><p>Tracked assets</p></div>
        <div className="admin-panel compact"><strong>Supabase</strong><p>Persistent media storage</p></div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Upload test asset</h2><p>Manual upload exists mainly to validate the storage contract before AI renderers start writing here.</p></div>
        </div>
        <form action={uploadSocialAssetAction} style={{ display: "grid", gap: 14, maxWidth: 720 }}>
          <label style={{ display: "grid", gap: 8 }}>
            <strong>Attach to post</strong>
            <select name="post_id" style={inputStyle} defaultValue="">
              <option value="">Unassigned asset</option>
              {posts.map((post) => <option key={post.id} value={post.id}>{post.title || "Untitled post"}</option>)}
            </select>
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <strong>Asset type</strong>
            <select name="asset_type" style={inputStyle} defaultValue="image">
              <option value="image">Image</option>
              <option value="carousel_slide">Carousel slide</option>
              <option value="video">Video</option>
              <option value="reel">Reel</option>
              <option value="audio">Audio</option>
              <option value="thumbnail">Thumbnail</option>
              <option value="screenshot">Screenshot</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <strong>File</strong>
            <input name="file" type="file" required style={inputStyle} accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/x-wav,audio/mp4" />
            <span>Current bucket limit: 50 MB. Large YouTube renders will use dedicated object storage later.</span>
          </label>

          <div><button type="submit" className="admin-status live" style={{ cursor: "pointer" }}>Upload to Supabase</button></div>
        </form>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Stored assets</h2><p>Database metadata points to private objects in the `flux-social-assets` bucket.</p></div></div>
        <div className="admin-list">
          {assets.map((asset) => (
            <div className="admin-list-row" key={asset.id} style={{ alignItems: "flex-start", gap: 18 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{asset.asset_type} · {asset.source}</strong>
                <span>{postById.get(asset.post_id || "")?.title || "Unassigned"}</span>
                <span>{formatBytes(asset.size_bytes)} · {asset.mime_type || "Unknown MIME"}</span>
                <span style={{ overflowWrap: "anywhere" }}>{asset.storage_path}</span>
              </div>
              <em>{asset.status}</em>
            </div>
          ))}
          {!assets.length ? <div className="admin-list-row"><div><strong>No social assets yet</strong><span>The asset contract is ready for static graphics, carousels and Remotion outputs.</span></div><em>empty</em></div> : null}
        </div>
      </section>
    </main>
  );
}
