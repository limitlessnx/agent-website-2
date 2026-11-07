import Link from "next/link";
import { uploadSocialAssetAction, uploadPrimarySocialLogoAction, uploadLicensedReelMusicAction } from "@/app/dashboard/social/assets/actions";
import { getSocialBrand } from "@/lib/social";
import { getPrimaryLogoAsset } from "@/lib/social-brand-assets";
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
  const [assets, posts, brand] = await Promise.all([listSocialAssets(), listSocialPosts(200), getSocialBrand()]);
  const currentLogo = brand ? await getPrimaryLogoAsset(brand.id) : null;
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

      <section className="admin-panel" aria-label="Primary brand logo">
        <div className="admin-panel-header">
          <div>
            <h2>Primary brand logo</h2>
            <p>Upload the official transparent PNG used on generated graphics, carousels and Reels. The previous media file is retained for rollback.</p>
          </div>
          <span className={currentLogo?.social_asset_id ? "admin-status live" : "admin-status warning"}>
            {currentLogo?.social_asset_id ? "Registered" : "Missing"}
          </span>
        </div>
        {currentLogo?.signed_url ? (
          <div style={{ marginBottom: 20, display: "grid", gap: 8 }}>
            <strong>Currently registered logo</strong>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", maxWidth: 420, minHeight: 130, padding: 24, borderRadius: 12, border: "1px solid var(--admin-border, #2d2d35)", background: "#101017" }}>
              <img src={currentLogo.signed_url} alt={`${brand?.name || "Brand"} current primary logo`} style={{ display: "block", maxWidth: "100%", maxHeight: 110, objectFit: "contain" }} />
            </div>
          </div>
        ) : null}
        {brand ? (
          <form action={uploadPrimarySocialLogoAction} encType="multipart/form-data" style={{ display: "grid", gap: 14, maxWidth: 620 }}>
            <label style={{ display: "grid", gap: 8 }}>
              <strong>Replacement transparent PNG for {brand.name}</strong>
              <input name="logo" type="file" required accept="image/png" style={inputStyle} />
              <span>PNG only, up to 5 MB. Use the original brand artwork; do not redraw or distort the logo.</span>
            </label>
            <div><button type="submit" className="admin-status live" style={{ cursor: "pointer" }}>Upload and set as primary logo</button></div>
          </form>
        ) : <p>Create a Social Brand before registering its logo.</p>}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Licensed Reel background music</h2>
            <p>Upload a soundtrack only if you own it or have explicit permission for social-media publishing. Reels use music quietly beneath narration.</p>
          </div>
        </div>
        <form action={uploadLicensedReelMusicAction} encType="multipart/form-data" style={{ display: "grid", gap: 12, maxWidth: 620 }}>
          <label style={{ display: "grid", gap: 8 }}>
            <strong>MP3, WAV or M4A · 20 MB maximum</strong>
            <input type="file" name="music" accept="audio/mpeg,audio/wav,audio/mp4" required style={inputStyle} />
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <input type="checkbox" name="licensed_for_social_usage" value="yes" required />
            <span>I own this audio or have a license that permits use in published social media videos.</span>
          </label>
          <div><button type="submit" className="admin-status live" style={{ cursor: "pointer" }}>Upload licensed soundtrack</button></div>
        </form>
      </section>

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
