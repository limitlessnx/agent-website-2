import Image from "next/image";
import Link from "next/link";
import { listEstates } from "@/lib/real-estate-catalog";
import ActionForm from "@/app/dashboard/real-estate/ActionForm";
import { assignPropertyEstateAction } from "@/app/dashboard/real-estate/actions";
import { deletePropertyAction, updatePropertyAction, uploadPropertyImagesAction } from "@/app/dashboard/actions";
import DeletePropertyButton from "./DeletePropertyButton";
import NewPropertyForm from "./NewPropertyForm";
import { isGoogleDriveConfigured } from "@/lib/google-drive";
import { getProperties } from "@/lib/limitless-data";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";

export default async function PropertiesPage() {
  const scope = await resolveAdminOrganizationScope();
  if (scope.kind !== "system" || scope.systemId !== "limitless-realty") {
    return <div className="admin-page"><div className="admin-page-header"><div><p className="admin-kicker">Limitless Realty</p><h1>Properties</h1><p>Switch to the Limitless Realty workspace to access this catalog. Your current workspace does not have access to these property records.</p></div></div></div>;
  }
  const properties = await getProperties(150, scope.organizationId);
  const estateResult = await listEstates(scope.organizationId).then((estates) => ({ estates, error: "" })).catch((error) => ({ estates: [], error: error instanceof Error ? error.message : "Estate catalog unavailable" }));
  const { estates, error: estateError } = estateResult;
  const driveReady = isGoogleDriveConfigured();
  return (
    <div className="admin-page">
      <style>{`
        .estate-header-actions{display:flex;flex-direction:column;align-items:stretch;gap:12px;width:100%}
        .estate-action-links{display:flex;flex-direction:column;align-items:stretch;gap:10px;width:100%}
        .estate-action-button{display:inline-flex;align-items:center;justify-content:center;gap:9px;box-sizing:border-box;width:100%;min-height:48px;padding:12px 16px;border:1px solid transparent;border-radius:12px;font-size:14px;font-weight:700;line-height:1.35;text-align:center;text-decoration:none;transition:background .15s ease,border-color .15s ease,transform .15s ease}
        .estate-action-button:hover{transform:translateY(-1px)}
        .estate-action-button:focus-visible{outline:3px solid #c4b5fd;outline-offset:3px}
        .estate-action-button-primary{color:#fff;background:linear-gradient(135deg,#7c3aed,#5b21b6);border-color:rgba(196,181,253,.55);box-shadow:0 8px 18px rgba(76,29,149,.26)}
        .estate-action-button-primary:hover{background:linear-gradient(135deg,#8b5cf6,#6d28d9)}
        .estate-action-button-secondary{color:#ede9fe;background:rgba(139,92,246,.12);border-color:rgba(167,139,250,.42)}
        .estate-action-button-secondary:hover{background:rgba(139,92,246,.22);border-color:rgba(196,181,253,.68)}
        .estate-action-icon{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:999px;background:rgba(255,255,255,.18);font-size:19px;line-height:1}
        @media(min-width:701px){.estate-header-actions{width:auto;align-items:flex-end}.estate-action-links{width:auto;flex-direction:row;flex-wrap:wrap;justify-content:flex-end}.estate-action-button{width:auto;min-width:180px}}
      `}</style>
      <div className="admin-page-header"><div><p className="admin-kicker">Limitless Realty</p><h1>Properties</h1><p>View the catalog first, then expand only the property you need to inspect or edit.</p></div><div className="admin-page-header-actions estate-header-actions"><nav className="estate-action-links" aria-label="Estate actions"><Link className="estate-action-button estate-action-button-primary" href="/dashboard/real-estate/estates#new-estate"><span className="estate-action-icon" aria-hidden="true">+</span>Add estate</Link><Link className="estate-action-button estate-action-button-secondary" href="/dashboard/real-estate/estates">Manage estates, terms & FAQs</Link></nav><span className={driveReady ? "admin-status live" : "admin-status warning"}>{driveReady ? "Google Drive ready" : "Drive env missing"}</span></div></div>
      <section className="admin-panel"><div className="admin-panel-header"><div><h2>Catalog</h2><p>{properties.length} property records. Tap a property name to reveal its details and controls.</p></div></div>
        <div className="property-editor-list">{properties.map((property) => { const previewImage = property.drive_photos_link || ""; return (
          <details key={property.id} className="property-editor-card admin-record-disclosure"><summary className="admin-record-summary"><div className="admin-record-summary-main"><span className="property-preview-avatar" aria-hidden="true">{previewImage ? <Image src={previewImage} alt="" width={44} height={44} unoptimized /> : <span className="property-preview-placeholder">P</span>}</span><div className="property-preview-copy"><strong>{property.title}</strong><span>{[property.location_area, property.location_city].filter(Boolean).join(", ") || "No location saved"}</span></div></div><div className="admin-record-summary-meta"><span>{property.price || "Price pending"}</span><em>{property.status || "active"}</em></div></summary>
            <div className="admin-record-disclosure-body">
              <section><h3>Estate / Assign to Estate</h3>{estateError?<p role="alert">Estate assignment unavailable: {estateError}</p>:<><ActionForm action={assignPropertyEstateAction} label="Save estate association"><input type="hidden" name="property_id" value={property.id}/><label>Estate<select name="estate_id" defaultValue={property.estate_id||""}><option value="">No estate — remove association</option>{estates.map(estate=><option key={estate.id} value={estate.id}>{estate.name}</option>)}</select></label></ActionForm>{property.estate_id?<p><Link href={`/dashboard/real-estate/estates/${property.estate_id}`}>Open assigned estate</Link></p>:null}<p><Link href="/dashboard/real-estate/estates#new-estate">Create an estate</Link></p></>}</section>
              <form action={updatePropertyAction} className="property-edit-form"><input type="hidden" name="property_id" value={property.id} /><div className="admin-form-grid compact"><input name="title" defaultValue={property.title} placeholder="Property title" required /><input name="price" defaultValue={property.price || ""} placeholder="Price" /><input name="location_area" defaultValue={property.location_area || ""} placeholder="Area/community" /><input name="location_city" defaultValue={property.location_city || ""} placeholder="City/state" /><input name="type" defaultValue={property.type || ""} placeholder="Type" /><select name="status" defaultValue={property.status || "active"}><option value="active">active</option><option value="inactive">inactive</option><option value="sold">sold</option></select><input name="drive_brochure_link" defaultValue={property.drive_brochure_link || ""} placeholder="Brochure link" /><textarea name="features" defaultValue={property.features || ""} placeholder="Title/features" /><textarea name="description" defaultValue={property.description || ""} placeholder="Brief/description" /><button type="submit">Save changes</button></div></form>
              <form action={uploadPropertyImagesAction} className="admin-inline-upload property-card-upload"><input type="hidden" name="property_id" value={property.id} /><input type="hidden" name="property_title" value={property.title} /><span className={previewImage ? "admin-status live" : "admin-status warning"}>{previewImage ? "image saved" : "image missing"}</span><input name="property_images" type="file" required accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,video/x-m4v" multiple aria-label={`Upload image for ${property.title}`} /><button type="submit">{previewImage ? "Add media" : "Upload media"}</button></form>
              <div className="property-danger-zone"><div><strong>Delete property</strong><span>Permanently remove this property from the Limitless Realty catalog.</span></div><form action={deletePropertyAction}><input type="hidden" name="property_id" value={property.id} /><DeletePropertyButton propertyId={property.id} propertyTitle={property.title} /></form></div>
            </div></details>); })}{!properties.length ? <p className="admin-empty">No property records exist yet.</p> : null}</div>
      </section>
      <details className="admin-form-disclosure"><summary>Add a new property</summary><div className="admin-form-disclosure-body"><NewPropertyForm estates={estates.map(({ id, name, status }) => ({ id, name, status }))} estateError={estateError} /></div></details>
      <style>{`.property-preview-avatar{width:48px;height:48px;min-width:48px;border-radius:999px;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;background:rgba(139,92,246,.14);border:1px solid rgba(139,92,246,.28)}.property-preview-avatar img{width:100%;height:100%;display:block;object-fit:cover}.property-preview-placeholder{font-size:14px;font-weight:700;opacity:.7}.property-preview-copy{min-width:0;display:grid;gap:3px}.property-preview-copy strong,.property-preview-copy span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.property-danger-zone{margin-top:18px;padding:14px 16px;border:1px solid rgba(239,68,68,.28);border-radius:14px;display:flex;align-items:center;justify-content:space-between;gap:16px;background:rgba(239,68,68,.05)}.property-danger-zone>div{display:grid;gap:4px}.property-danger-zone span{font-size:12px;opacity:.7}.danger-button{background:rgba(239,68,68,.12)!important;border:1px solid rgba(239,68,68,.45)!important;color:#f87171!important}.danger-button:disabled{opacity:.6;cursor:wait}@media(max-width:700px){.property-preview-avatar{width:42px;height:42px;min-width:42px}.property-danger-zone{align-items:stretch;flex-direction:column}.danger-button{width:100%}}`}</style>
    </div>
  );
}
