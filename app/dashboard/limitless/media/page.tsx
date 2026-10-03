import { ExternalLink, ImagePlus } from "@/components/admin/ServerIcons";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { getProperties } from "@/lib/limitless-data";
import PropertyImageUploader from "./PropertyImageUploader";

export const dynamic = "force-dynamic";

type MediaAsset = {
  id: string;
  property_id: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_name: string | null;
  caption: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

function publicUrl(asset: MediaAsset) {
  const configured = asset.metadata?.public_url;
  if (typeof configured === "string" && configured.startsWith("http")) return configured;
  return null;
}

function PropertyMediaCard({ property, linked = false, assets = [] }: { property: Awaited<ReturnType<typeof getProperties>>[number]; linked?: boolean; assets?: MediaAsset[] }) {
  const images = assets.filter((asset) => String(asset.mime_type || "").startsWith("image/"));
  const videos = assets.filter((asset) => String(asset.mime_type || "").startsWith("video/"));
  return (
    <article className="property-media-card">
      <div className="property-media-info">
        <span className={`property-media-badge ${linked ? "linked" : "missing"}`}>{linked ? "Media linked" : "Media needed"}</span>
        <h3>{property.title}</h3>
        <p>{[property.location_area, property.location_city].filter(Boolean).join(", ") || "No location saved"}</p>
        <small>{images.length} image{images.length === 1 ? "" : "s"} · {videos.length} video{videos.length === 1 ? "" : "s"}</small>
        {linked && property.drive_photos_link ? <a href={property.drive_photos_link} target="_blank" rel="noreferrer">Open image <ExternalLink size={14} /></a> : null}
      </div>

      {assets.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 10, marginBottom: 14 }}>
          {assets.slice(0, 8).map((asset) => {
            const url = publicUrl(asset);
            if (!url) return null;
            return String(asset.mime_type || "").startsWith("video/") ? (
              <video key={asset.id} src={url} controls preload="metadata" style={{ width: "100%", aspectRatio: "16/10", objectFit: "cover", borderRadius: 10 }} />
            ) : (
              <img key={asset.id} src={url} alt={asset.caption || property.title} style={{ width: "100%", aspectRatio: "16/10", objectFit: "cover", borderRadius: 10 }} />
            );
          })}
        </div>
      ) : null}

      <PropertyImageUploader propertyId={property.id} propertyTitle={property.title} existingLink={property.drive_photos_link} />
    </article>
  );
}

export default async function MediaPage() {
  const scope = await resolveAdminOrganizationScope();
  const [properties, mediaResult] = await Promise.all([
    getProperties(200),
    createAdminClient().from("media_assets").select("id,property_id,storage_bucket,storage_path,mime_type,file_name,caption,metadata,created_at").eq("organization_id", scope.organizationId).eq("direction", "outbound").not("property_id", "is", null).order("created_at", { ascending: false }).limit(500),
  ]);
  if (mediaResult.error) throw mediaResult.error;
  const assets = (mediaResult.data || []) as MediaAsset[];
  const byProperty = new Map<string, MediaAsset[]>();
  for (const asset of assets) {
    const list = byProperty.get(asset.property_id) || [];
    list.push(asset);
    byProperty.set(asset.property_id, list);
  }
  const missing = properties.filter((property) => !(byProperty.get(property.id) || []).some((asset) => String(asset.mime_type || "").startsWith("image/")) && !property.drive_photos_link);
  const linked = properties.filter((property) => (byProperty.get(property.id) || []).length || property.drive_photos_link);

  return (
    <div className="admin-page property-media-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Limitless Realty</p>
          <h1>Property Media</h1>
          <p>Manage property pictures and videos in one place. Approved media is registered against the exact property so Maia can retrieve and send it safely through WhatsApp.</p>
        </div>
        <span className="admin-status live">Images + videos ready</span>
      </div>

      <div className="admin-metric-grid">
        <div className="admin-metric-card"><p>Properties</p><strong>{properties.length}</strong><span>In the Limitless catalog</span></div>
        <div className="admin-metric-card"><p>Images</p><strong>{assets.filter((asset) => String(asset.mime_type || "").startsWith("image/")).length}</strong><span>Registered media assets</span></div>
        <div className="admin-metric-card"><p>Videos</p><strong>{assets.filter((asset) => String(asset.mime_type || "").startsWith("video/")).length}</strong><span>Registered media assets</span></div>
      </div>

      <section className="admin-panel media-config-warning">
        <ImagePlus size={22} />
        <div><h2>One property media system</h2><p>Pictures and videos are stored in Supabase Storage and registered in the media library. Images also update the property's catalog cover/gallery fields.</p></div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Needs media</h2><p>Add at least one picture, then add videos or additional pictures as needed.</p></div></div>
        <div className="property-media-grid">
          {missing.map((property) => <PropertyMediaCard key={property.id} property={property} assets={byProperty.get(property.id) || []} />)}
          {!missing.length ? <p className="admin-empty">Every visible property has at least one linked image or media asset.</p> : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Media library</h2><p>Review registered pictures and videos by property and add more without leaving this page.</p></div></div>
        <div className="property-media-grid">
          {linked.map((property) => <PropertyMediaCard key={property.id} property={property} linked assets={byProperty.get(property.id) || []} />)}
          {!linked.length ? <p className="admin-empty">No property media has been registered yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
