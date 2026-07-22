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
          <p>Control Maia&apos;s live property catalog, pricing, title details, and uploaded media.</p>
        </div>
        <span className={driveReady ? "admin-status live" : "admin-status warning"}>
          {driveReady ? "Google Drive ready" : "Drive env missing"}
        </span>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Add Property</h2>
            <p>Save the property details and upload images together. Benin City entries should include Edo State.</p>
          </div>
        </div>
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
            <span>Property images</span>
            <input name="property_images" type="file" accept="image/*" multiple />
          </label>
          <input name="drive_brochure_link" placeholder="Brochure link" />
          <textarea name="features" placeholder="Title/features" />
          <textarea name="description" placeholder="Brief/description" />
          <button type="submit">Save property</button>
        </form>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Catalog</h2>
            <p>{properties.length} property records loaded. Edit details here so Maia answers with the correct catalog data.</p>
          </div>
        </div>
        <div className="property-editor-list">
          {properties.map((property) => (
            <article key={property.id} className="property-editor-card">
              <form action={updatePropertyAction} className="property-edit-form">
                <input type="hidden" name="property_id" value={property.id} />
                <div className="property-edit-header">
                  <div>
                    <strong>{property.title}</strong>
                    <span>{[property.location_area, property.location_city].filter(Boolean).join(", ") || "No location saved"}</span>
                  </div>
                  <span className={property.drive_photos_link ? "admin-status live" : "admin-status warning"}>
                    {property.drive_photos_link ? "images saved" : "images missing"}
                  </span>
                </div>
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
                <input name="property_images" type="file" accept="image/*" multiple aria-label={`Upload images for ${property.title}`} />
                <button type="submit">{property.drive_photos_link ? "Replace images" : "Upload images"}</button>
              </form>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
