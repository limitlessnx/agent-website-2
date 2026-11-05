import {hotelSetupAccess,loadHotelSetup} from "@/lib/hotel-setup";
import HotelSetup from "@/components/portal/hotel/HotelSetup";
export const dynamic="force-dynamic";
export const metadata={title:"Hotel setup | Fluxknight"};
export default async function HotelSetupPage(){
  let data;try{const {session,permissions}=await hotelSetupAccess();data=await loadHotelSetup(session.organizationId,permissions,session.isAdminPreview);}
  catch{data=null;}
  if(!data)return <main className="portal-page"><h1>Hotel setup unavailable</h1><p>Sign in with an authorized hotel account. If setup is still unavailable, ask your administrator to check workspace configuration.</p></main>;
  return <HotelSetup initialData={data}/>;
}
