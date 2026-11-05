import { redirect } from "next/navigation";
import { hotelOverviewAccess,loadHotelOverview } from "@/lib/hotel-overview";
import { HotelWorkspaceError } from "@/lib/hotel-booking-service";
import HotelOverview from "./HotelOverview";
export default async function HotelOverviewPage(){
  let access;try{access=await hotelOverviewAccess();}catch(error){if(error instanceof HotelWorkspaceError&&error.status===401)redirect("/account/login");return <main className="portal-page"><h1>Hotel Overview unavailable</h1><p>Ask your administrator to check your active hotel workspace and guest-record permissions.</p></main>;}
  let data=null;try{data=await loadHotelOverview(access.session.organizationId,access.permissions,Boolean(access.session.isAdminPreview));}catch{/* The client offers a deliberate retry without showing fabricated zero totals. */}
  return <HotelOverview initialData={data}/>;
}
