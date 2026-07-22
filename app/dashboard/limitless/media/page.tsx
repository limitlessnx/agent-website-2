import { uploadPropertyImagesAction } from "@/app/dashboard/actions";
import { isGoogleDriveConfigured } from "@/lib/google-drive";
import { getProperties } from "@/lib/limitless-data";

export default async function MediaPage() {
  const properties = await getProperties(200);
  const driveReady = isGoogleDriveConfigured();
  const missing = properties.filter((property) => !property.drive_photos_link);
  const linked = properties.filter((property) => property.drive_photos_link);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Limitless Realty</p>
          <h1>Property Media</h1>
          <p>Upload property images directly. The system saves them to Google Drive and attaches the link to the property.</p>
        </div>
        <span className={driveReady ? "admin-status live" : "admin-status warning"}>
          {driveReady ? "Google Drive ready" : "Drive env missing"}
        </span>
      </div>

      <div className="admin-metric-grid">
        <div className="admin-metric-card"><p>Linked images</p><strong>{linked.length}</strong><span>Maia can share media</span></div>
        <div className="admin-metric-card"><p>Missing images</p><strong>{missing.length}</strong><span>Needs upload</span></div>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Missing Image Uploads</h2>
            <p>Select images for each property. After upload, Maia can use the saved Google Drive link.</p>
          </div>
        </div>
        <div className="admin-list">
          {missing.map((property) => (
            <div key={property.id} className="admin-list-row media-upload-row">
              <div>
                <strong>{property.title}</strong>
                <span>{[property.location_area, property.location_city].filter(Boolean).join(", ") || "No location saved"}</span>
              </div>
              <form action={uploadPropertyImagesAction} className="admin-inline-upload">
                <input type="hidden" name="property_id" value={property.id} />
                <input type="hidden" name="property_title" value={property.title} />
                <input name="property_images" type="file" accept="image/*" multiple aria-label={`Upload images for ${property.title}`} />
                <button type="submit">Upload</button>
              </form>
            </div>
          ))}
          {!missing.length ? <p className="admin-empty">All visible properties have image links.</p> : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Linked Media</h2>
            <p>Properties with saved image folders.</p>
          </div>
        </div>
        <div className="admin-list">
          {linked.map((property) => (
            <div key={property.id} className="admin-list-row media-upload-row">
              <div>
                <strong>{property.title}</strong>
                <span>{[property.location_area, property.location_city].filter(Boolean).join(", ") || "No location saved"}</span>
              </div>
              <form action={uploadPropertyImagesAction} className="admin-inline-upload">
                <input type="hidden" name="property_id" value={property.id} />
                <input type="hidden" name="property_title" value={property.title} />
                <span className="admin-status live">saved</span>
                <input name="property_images" type="file" accept="image/*" multiple aria-label={`Replace images for ${property.title}`} />
                <button type="submit">Replace</button>
              </form>
            </div>
          ))}
          {!linked.length ? <p className="admin-empty">No linked property media yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
