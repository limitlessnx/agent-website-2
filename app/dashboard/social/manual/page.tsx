import RealtySocialCenter from "@/components/admin/RealtySocialCenter";
import {requireRealtySocialAdmin} from "@/lib/social-real-estate-access";
import {getSocialBrand} from "@/lib/social";
export const maxDuration=300;
export default async function RealtyManualGenerationPage(){
  await requireRealtySocialAdmin();
  return <RealtySocialCenter brand={await getSocialBrand()} manual/>;
}
