import {getMetaCredentials} from "@/lib/meta-integration";
import {REALTY_SOCIAL_ORGANIZATION} from "@/lib/social-real-estate-policy";

export const REALTY_INSTAGRAM_CALLBACK="/api/social/realty/instagram/callback";
export const FLUX_SOCIAL_ORGANIZATION="15046426-e520-438b-8694-7662a6986efb";
export function realtyInstagramOrigin(request:Request){
  const url=new URL(request.url),host=request.headers?.get("host")||url.host;
  if(process.env.NODE_ENV==="production"){
    if(host!=="fluxknight.space")throw new Error("Connect Instagram from fluxknight.space after reviewing the preview.");
    return "https://fluxknight.space";
  }
  // Next dev can normalize Request.url to localhost while the actual browser
  // uses 127.0.0.1. Preserve that browser's cookie origin for local verification.
  return /^(localhost|127\.0\.0\.1):[0-9]+$/.test(host)?`http://${host}`:url.origin;
}
// Only the provider application's ID/secret are shared server-side. Access
// tokens and connected account IDs never fall back to the platform brand.
export async function realtyInstagramApp(){
  const own=await getMetaCredentials(REALTY_SOCIAL_ORGANIZATION);
  const app=own?.instagram_app_id&&own?.instagram_app_secret?own:await getMetaCredentials(FLUX_SOCIAL_ORGANIZATION);
  const appId=String(app?.instagram_app_id||"").trim(),appSecret=String(app?.instagram_app_secret||"").trim();
  if(!appId||!appSecret)throw new Error("The Instagram provider application is not configured.");
  return {appId,appSecret,own:own||{}};
}
