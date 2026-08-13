import { ExternalLink, ImagePlus } from "@/components/admin/ServerIcons";
import { isGoogleDriveConfigured } from "@/lib/google-drive";
import { getProperties } from "@/lib/limitless-data";
import PropertyImageUploader from "./PropertyImageUploader";

export const dynamic = "force-dynamic";

function PropertyMediaCard({ property, linked = false }: { property: Awaited<ReturnType<typeof getProperties>>[number]; linked?: boolean }) {
  return (
    <article className="property-media-card">
      <div className="property-media-info">
        <span className={`property-media-badge ${linked ? "linked" : "missing"}`}>{linked ? "Media linked" : "Images needed"}</span>
        <h3>{property.title}</h3>
        <p>{[property.location_area, property.location_city].filter(Boolean).join(", ") || "No location saved"}</p>
        {linked && property.drive_photos_link ? (
          <a href={property.drive_photos_link} target="_blank" rel="noreferrer">Open Drive folder <ExternalLink size={14} /></a>
        ) : null}
      </div>
      <PropertyImageUploader propertyId={property.id} propertyTitle={property.title} existingLink={property.drive_photos_link} />
    </article>
  );
}

export default async function MediaPage() {
  const properties = await getProperties(200);
  const driveReady = isGoogleDriveConfigured();
  const missing = properties.filter((property) => !property.drive_photos_link);
  const linked = properties.filter((property) => property.drive_photos_link);

  return (
    <div className="admin-page property-media-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Limitless Realty</p>
          <h1>Property Media</h1>
          <p>Upload property images directly. Images are compressed first, then saved to Google Drive and attached to the correct property.</p>
        </div>
        <span className={driveReady ? "admin-status live" : "admin-status warning"}>
          {driveReady ? "Google Drive ready" : "Drive setup required"}
        </span>
      </div>

      <div className="admin-metric-grid">
        <div className="admin-metric-card"><p>Linked images</p><strong>{linked.length}</strong><span>Maia can share media</span></div>
        <div className="admin-metric-card"><p>Missing images</p><strong>{missing.length}</strong><span>Needs upload</span></div>
      </div>

      {!driveReady ? (
        <section className="admin-panel media-config-warning">
          <ImagePlus size={22} />
          <div><h2>Google Drive is not configured</h2><p>Add the service-account email and private key in Vercel before uploading images.</p></div>
        </section>
      ) : null}

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Missing Image Uploads</h2><p>Select one or more images for each property. Large phone photos will be compressed automatically.</p></div>
        </div>
        <div className="property-media-grid">
          {missing.map((property) => <PropertyMediaCard key={property.id} property={property} />)}
          {!missing.length ? <p className="admin-empty">All visible properties have image links.</p> : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Linked Media</h2><p>Review existing folders or add more images to a property.</p></div>
        </div>
        <div className="property-media-grid">
          {linked.map((property) => <PropertyMediaCard key={property.id} property={property} linked />)}
          {!linked.length ? <p className="admin-empty">No linked property media yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
