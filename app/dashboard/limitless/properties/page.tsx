import { createPropertyAction } from "@/app/dashboard/actions";
import { getProperties } from "@/lib/limitless-data";

export default async function PropertiesPage() {
  const properties = await getProperties(150);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Limitless Realty</p>
          <h1>Properties</h1>
          <p>Control Maia’s property catalog, pricing, title details, and image links.</p>
        </div>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Add Property</h2>
          <p>Benin City entries should include Edo State in the city/location field.</p>
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
          <input name="drive_photos_link" placeholder="Google Drive photo link" />
          <input name="drive_brochure_link" placeholder="Brochure link" />
          <textarea name="features" placeholder="Title/features" />
          <textarea name="description" placeholder="Brief/description" />
          <button type="submit">Save property</button>
        </form>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Catalog</h2>
          <p>{properties.length} property records loaded.</p>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Title</th><th>Location</th><th>Price</th><th>Type</th><th>Status</th><th>Image</th></tr>
            </thead>
            <tbody>
              {properties.map((property) => (
                <tr key={property.id}>
                  <td>{property.title}</td>
                  <td>{[property.location_area, property.location_city].filter(Boolean).join(", ") || "-"}</td>
                  <td>{property.price || "-"}</td>
                  <td>{property.type || "-"}</td>
                  <td>{property.status || "active"}</td>
                  <td>{property.drive_photos_link ? "linked" : "missing"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
