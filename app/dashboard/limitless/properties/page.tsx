import { createPropertyAction, uploadPropertyImagesAction } from "@/app/dashboard/actions";
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
            <p>{properties.length} property records loaded.</p>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Location</th>
                <th>Price</th>
                <th>Type</th>
                <th>Status</th>
                <th>Images</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((property) => (
                <tr key={property.id}>
                  <td>{property.title}</td>
                  <td>{[property.location_area, property.location_city].filter(Boolean).join(", ") || "-"}</td>
                  <td>{property.price || "-"}</td>
                  <td>{property.type || "-"}</td>
                  <td>{property.status || "active"}</td>
                  <td>
                    <form action={uploadPropertyImagesAction} className="admin-inline-upload">
                      <input type="hidden" name="property_id" value={property.id} />
                      <input type="hidden" name="property_title" value={property.title} />
                      <span className={property.drive_photos_link ? "admin-status live" : "admin-status warning"}>
                        {property.drive_photos_link ? "saved" : "missing"}
                      </span>
                      <input name="property_images" type="file" accept="image/*" multiple aria-label={`Upload images for ${property.title}`} />
                      <button type="submit">{property.drive_photos_link ? "Replace" : "Upload"}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
