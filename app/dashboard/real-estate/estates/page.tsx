import Image from "next/image";
import Link from "next/link";
import { requireRealEstateAccess } from "@/lib/real-estate-access";
import { listEstates } from "@/lib/real-estate-catalog";
import EstateForm from "./EstateForm";
import "../real-estate.css";
export const dynamic="force-dynamic";
export default async function EstateCatalogPage(){
 const scope=await requireRealEstateAccess("catalog.read");
 let estates:Awaited<ReturnType<typeof listEstates>>=[];let error="";
 try{estates=await listEstates(scope.organizationId);}catch(e){error=e instanceof Error?e.message:"Estate catalog is unavailable.";}
 return <main className="admin-page real-estate-page">
  <header className="admin-page-header"><div><p className="admin-kicker">{scope.name}</p><h1>Estate Catalog</h1><p>Tenant-owned estates and approved business knowledge, linked to the original property records.</p></div><Link href="/dashboard/real-estate">Operations overview</Link></header>
  <nav className="real-estate-links"><Link href="/dashboard/real-estate/properties">General Property Catalog</Link><a href="#new-estate">Create an estate</a></nav>
  {error?<section className="admin-panel" role="alert"><h2>Catalog unavailable</h2><p>{error}</p><p>No sample estates are substituted. The catalog migration and tenant authorization must be available before use.</p></section>:<section className="real-estate-cards">{estates.map(estate=><article key={estate.id} className="real-estate-card">{estate.cover_image_url?<Image src={estate.cover_image_url} alt={`${estate.name} cover`} width={640} height={360} unoptimized/>:null}<span className="admin-status">{estate.status} · knowledge {estate.knowledge_status}</span><h2><Link href={`/dashboard/real-estate/estates/${estate.id}`}>{estate.name}</Link></h2><p>{estate.location||"Location not provided"}</p><p>{estate.linked_property_count||0} linked properties</p><Link href={`/dashboard/real-estate/estates/${estate.id}`}>Open and edit estate</Link></article>)}{!estates.length?<p>No estates yet. Create your first estate below; no listings will be copied.</p>:null}</section>}
  {!error?<details id="new-estate" className="admin-panel admin-form-disclosure"><summary>Create an estate</summary><div className="admin-form-disclosure-body"><EstateForm/></div></details>:null}
 </main>;
}
