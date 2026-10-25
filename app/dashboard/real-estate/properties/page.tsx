import Link from "next/link";
import { requireRealEstateAccess } from "@/lib/real-estate-access";
import { listEstates } from "@/lib/real-estate-catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import ActionForm from "../ActionForm";
import { assignPropertyEstateAction } from "../actions";
import "../real-estate.css";
export const dynamic="force-dynamic";
export default async function RealEstatePropertiesPage(){
 const scope=await requireRealEstateAccess("catalog.read");const estates=await listEstates(scope.organizationId);
 const {data:properties,error}=await createAdminClient().from("properties").select("id,title,location_area,location_city,price,status,estate_id,drive_photos_link,cover_image_url").eq("organization_id",scope.organizationId).order("updated_at",{ascending:false}).limit(250);
 if(error)throw error;
 return <main className="admin-page real-estate-page"><header className="admin-page-header"><div><p className="admin-kicker">{scope.name}</p><h1>General Property Catalog</h1><p>Assign estates without changing price, ownership, status, images or the original listing.</p></div><Link href="/dashboard/real-estate/estates">Estate Catalog</Link></header>
 {scope.slug==="limitless-realty"?<p><Link href="/dashboard/limitless/properties">Open the existing full property editor</Link></p>:null}
 {!estates.length?<p>No estates exist. <Link href="/dashboard/real-estate/estates#new-estate">Create an estate</Link> before assigning one.</p>:null}
 <section className="admin-panel">{(properties||[]).map(property=>{const estate=estates.find(item=>item.id===property.estate_id);return <details id={`property-${property.id}`} key={property.id} className="admin-record-disclosure"><summary>{property.title} · {property.status||"Unknown"}</summary><div className="admin-record-disclosure-body">{property.cover_image_url||property.drive_photos_link?<img className="real-estate-cover" src={property.cover_image_url||property.drive_photos_link} alt={property.title||"Property"}/>:null}<p>{[property.location_area,property.location_city].filter(Boolean).join(", ")} · {String(property.price||"Price not provided")}</p>{estate?<p>Assigned estate: <Link href={`/dashboard/real-estate/estates/${estate.id}`}>{estate.name}</Link></p>:<p>No estate assigned.</p>}<ActionForm action={assignPropertyEstateAction} label="Save estate association"><input type="hidden" name="property_id" value={property.id}/><label className="wide">Estate / Assign to Estate<select name="estate_id" defaultValue={property.estate_id||""}><option value="">No estate — remove association</option>{estates.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></ActionForm></div></details>;})}{!properties?.length?<p>No property listings found for this organization.</p>:null}</section></main>;
}
