import { redirect } from "next/navigation";
import { hotelCatalogAccess } from "@/lib/hotel-catalog-access";
import { loadHotelCatalog } from "@/lib/hotel-catalog";
import { HotelWorkspaceError } from "@/lib/hotel-booking-service";
import HotelCatalog from "@/components/portal/hotel/HotelCatalog";
export const dynamic="force-dynamic";
export const metadata={title:"Hotel Catalog | Fluxknight"};
export default async function HotelCatalogPage({searchParams}:{searchParams:Promise<{kind?:string}>}){
  let access;
  try {access=await hotelCatalogAccess();}catch(error){if(error instanceof HotelWorkspaceError&&error.status===401)redirect("/account/login");return <main className="portal-page"><h1>Hotel Catalog unavailable</h1><p>Ask your administrator to check your hotel workspace and guest-record permissions.</p></main>;}
  let data=null;try{data=await loadHotelCatalog(access.session.organizationId,access.canManage);}catch{/* Recoverable setup state. */}
  const query=await searchParams;
  return <HotelCatalog key={`${access.session.organizationId}:${query.kind==="service"?"service":"room"}`} initialData={data} initialKind={query.kind==="service"?"service":"room"} initialError={data?"":"Unable to load the catalog. Refresh or ask your administrator to complete hotel setup."}/>;
}
