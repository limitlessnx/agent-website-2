import { getProperties } from "@/lib/limitless-data";

export default async function MediaPage() {
  const properties = await getProperties(200);
  const missing = properties.filter((property) => !property.drive_photos_link);
  const linked = properties.filter((property) => property.drive_photos_link);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Limitless Realty</p>
          <h1>Property Media</h1>
          <p>Track which properties Maia can show images for and which still need Google Drive links.</p>
        </div>
      </div>

      <div className="admin-metric-grid">
        <div className="admin-metric-card"><p>Linked images</p><strong>{linked.length}</strong><span>Maia can share media</span></div>
        <div className="admin-metric-card"><p>Missing images</p><strong>{missing.length}</strong><span>Needs upload/link</span></div>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Missing Image Links</h2>
          <p>Use Telegram: “Upload picture to [property name]”, then send the photo.</p>
        </div>
        <div className="admin-list">
          {missing.map((property) => (
            <div key={property.id} className="admin-list-row">
              <div>
                <strong>{property.title}</strong>
                <span>{[property.location_area, property.location_city].filter(Boolean).join(", ") || "No location saved"}</span>
              </div>
              <em>missing</em>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
