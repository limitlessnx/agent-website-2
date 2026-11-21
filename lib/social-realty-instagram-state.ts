import {createHmac,randomBytes,timingSafeEqual} from "node:crypto";
import {REALTY_SOCIAL_ORGANIZATION} from "@/lib/social-real-estate-policy";

type State={organizationId:string;actor:string;sessionIssuedAt:number;account:string;issuedAt:number;nonce:string};
function secret(){const key=process.env.INSTAGRAM_OAUTH_STATE_SECRET||process.env.ADMIN_SESSION_SECRET;if(!key)throw new Error("Secure Instagram authorization is not configured.");return key;}
export function realtyInstagramAccount(value:string){const account=value.trim().replace(/^@/,"").toLowerCase();if(!/^[a-z0-9_.]{1,30}$/.test(account))throw new Error("Enter the Limitless Realty Instagram handle.");return account;}
export function createRealtyInstagramState(actor:string,sessionIssuedAt:number,account:string){
  const value=Buffer.from(JSON.stringify({organizationId:REALTY_SOCIAL_ORGANIZATION,actor:createHmac("sha256",secret()).update("actor:"+actor.toLowerCase()).digest("hex"),sessionIssuedAt,account:realtyInstagramAccount(account),issuedAt:Date.now(),nonce:randomBytes(32).toString("hex")} satisfies State)).toString("base64url");
  return value+"."+createHmac("sha256",secret()).update(value).digest("base64url");
}
export function verifyRealtyInstagramState(value:string,cookie:string,actor:string,sessionIssuedAt:number):State|null{
  try{
    if(!value||value!==cookie||value.length>2048)return null;
    const [body,signature,...extra]=value.split(".");if(extra.length||!body||!signature)return null;
    const expected=createHmac("sha256",secret()).update(body).digest("base64url");
    if(signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return null;
    const state=JSON.parse(Buffer.from(body,"base64url").toString()) as State;
    if(state.organizationId!==REALTY_SOCIAL_ORGANIZATION||state.actor!==createHmac("sha256",secret()).update("actor:"+actor.toLowerCase()).digest("hex")||state.sessionIssuedAt!==sessionIssuedAt||!Number.isFinite(state.issuedAt)||Date.now()-state.issuedAt>600000||state.issuedAt>Date.now()+60000||!state.nonce||state.account!==realtyInstagramAccount(state.account))return null;
    return state;
  }catch{return null;}
}

export function realtyInstagramCookie(){return process.env.NODE_ENV==="production"?"__Host-flux_realty_instagram_state":"flux_realty_instagram_state";}
