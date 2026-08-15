import { createPropertyAction, updatePropertyAction, uploadPropertyImagesAction } from "@/app/dashboard/actions";
import { isGoogleDriveConfigured } from "@/lib/google-drive";
import { getProperties } from "@/lib/limitless-data";

export default async function PropertiesPage() {
  const properties = await getProperties(150);
  const driveReady = isGoogleDriveConfigured();

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Limitless Realty</p>
          <h1>Properties</h1>
          <p>View the catalog first, then expand only the property you need to inspect or edit.</p>
        </div>
        <span className={driveReady ? "admin-status live" : "admin-status warning"}>
          {driveReady ? "Google Drive ready" : "Drive env missing"}
        </span>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Catalog</h2>
            <p>{properties.length} property records. Tap a property name to reveal its details and controls.</p>
          </div>
        </div>
        <div className="property-editor-list">
          {properties.map((property) => {
            const previewImage = property.drive_photos_link || "";
            return (
              <details key={property.id} className="property-editor-card admin-record-disclosure">
                <summary className="admin-record-summary">
                  <div className="admin-record-summary-main">
                    <span className="property-preview-avatar" aria-hidden="true">
                      {previewImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={previewImage} alt="" />
                      ) : (
                        <span className="property-preview-placeholder">P</span>
                      )}
                    </span>
                    <div className="property-preview-copy">
                      <strong>{property.title}</strong>
                      <span>{[property.location_area, property.location_city].filter(Boolean).join(", ") || "No location saved"}</span>
                    </div>
                  </div>
                  <div className="admin-record-summary-meta">
                    <span>{property.price || "Price pending"}</span>
                    <em>{property.status || "active"}</em>
                  </div>
                </summary>

                <div className="admin-record-disclosure-body">
                  <form action={updatePropertyAction} className="property-edit-form">
                    <input type="hidden" name="property_id" value={property.id} />
                    <div className="admin-form-grid compact">
                      <input name="title" defaultValue={property.title} placeholder="Property title" required />
                      <input name="price" defaultValue={property.price || ""} placeholder="Price" />
                      <input name="location_area" defaultValue={property.location_area || ""} placeholder="Area/community" />
                      <input name="location_city" defaultValue={property.location_city || ""} placeholder="City/state" />
                      <input name="type" defaultValue={property.type || ""} placeholder="Type" />
                      <select name="status" defaultValue={property.status || "active"}>
                        <option value="active">active</option>
                        <option value="inactive">inactive</option>
                        <option value="sold">sold</option>
                      </select>
                      <input name="drive_brochure_link" defaultValue={property.drive_brochure_link || ""} placeholder="Brochure link" />
                      <textarea name="features" defaultValue={property.features || ""} placeholder="Title/features" />
                      <textarea name="description" defaultValue={property.description || ""} placeholder="Brief/description" />
                      <button type="submit">Save changes</button>
                    </div>
                  </form>

                  <form action={uploadPropertyImagesAction} className="admin-inline-upload property-card-upload">
                    <input type="hidden" name="property_id" value={property.id} />
                    <input type="hidden" name="property_title" value={property.title} />
                    <span className={previewImage ? "admin-status live" : "admin-status warning"}>
                      {previewImage ? "image saved" : "image missing"}
                    </span>
                    <input name="property_images" type="file" accept="image/*" aria-label={`Upload image for ${property.title}`} />
                    <button type="submit">{previewImage ? "Replace image" : "Upload image"}</button>
                  </form>
                </div>
              </details>
            );
          })}
          {!properties.length ? <p className="admin-empty">No property records exist yet.</p> : null}
        </div>
      </section>

      <details className="admin-form-disclosure">
        <summary>Add a new property</summary>
        <div className="admin-form-disclosure-body">
          <form action={createPropertyAction} className="admin-form-grid">
            <input name="title" placeholder="Property title" required />
            <input name="price" placeholder="Price" />
            <input name="location_area" placeholder="Area/community" />
            <input name="location_city" placeholder="City/state" />
            <input name="type" placeholder="Type" />
            <select name="status" defaultValue="active">
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="sold">sold</option>
            </select>
            <label className="admin-file-field">
              <span>Property image</span>
              <input name="property_images" type="file" accept="image/*" />
            </label>
            <input name="drive_brochure_link" placeholder="Brochure link" />
            <textarea name="features" placeholder="Title/features" />
            <textarea name="description" placeholder="Brief/description" />
            <button type="submit">Save property</button>
          </form>
        </div>
      </details>

      <style>{`
        .property-preview-avatar {
          width: 48px;
          height: 48px;
          min-width: 48px;
          border-radius: 999px;
          overflow: hidden;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(139, 92, 246, 0.14);
          border: 1px solid rgba(139, 92, 246, 0.28);
        }
        .property-preview-avatar img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }
        .property-preview-placeholder {
          font-size: 14px;
          font-weight: 700;
          opacity: 0.7;
        }
        .property-preview-copy {
          min-width: 0;
          display: grid;
          gap: 3px;
        }
        .property-preview-copy strong,
        .property-preview-copy span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        @media (max-width: 700px) {
          .property-preview-avatar {
            width: 42px;
            height: 42px;
            min-width: 42px;
          }
        }
      `}</style>
    </div>
  );
}
