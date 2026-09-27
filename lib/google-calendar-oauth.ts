import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

type Json=Record<string,unknown>;

export const GOOGLE_CALENDAR_SCOPES=[
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];

export type GoogleCalendarChoice={
  id:string;
  summary:string;
  primary:boolean;
  accessRole:string;
  timeZone:string;
};

const REQUIRED_GOOGLE_CALENDAR_SCOPES=[
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];

function text(value:unknown){return typeof value==="string"?value.trim():"";}

export function googleCalendarOAuthConfig(origin?:string){
  const clientId=text(process.env.GOOGLE_CALENDAR_CLIENT_ID||process.env.GOOGLE_OAUTH_CLIENT_ID);
  const clientSecret=text(process.env.GOOGLE_CALENDAR_CLIENT_SECRET||process.env.GOOGLE_OAUTH_CLIENT_SECRET);
  const redirectUri=text(process.env.GOOGLE_CALENDAR_REDIRECT_URI)
    || (origin?new URL("/api/integrations/google-calendar/callback",origin).toString():"");
  if(!clientId||!clientSecret){
    throw new Error("Fluxknight Google Calendar OAuth is not configured.");
  }
  if(!redirectUri) throw new Error("Google Calendar OAuth redirect URI is not configured.");
  return {clientId,clientSecret,redirectUri};
}

function stateSecret(){
  const secret=process.env.CLIENT_SESSION_SECRET
    || process.env.ADMIN_SESSION_SECRET
    || process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  if(secret) return secret;
  if(process.env.NODE_ENV!=="production") return "development-google-calendar-state";
  throw new Error("Google Calendar OAuth state signing is not configured.");
}

export function createGoogleCalendarState(input:{organizationId:string;userId:string}){
  const payload=Buffer.from(JSON.stringify({
    ...input,
    nonce:randomBytes(18).toString("base64url"),
    issuedAt:Date.now(),
  })).toString("base64url");
  const signature=createHmac("sha256",stateSecret()).update(payload).digest("base64url");
  return payload+"."+signature;
}

export function verifyGoogleCalendarState(value:string){
  const [payload,signature]=value.split(".");
  if(!payload||!signature) return null;
  const expected=createHmac("sha256",stateSecret()).update(payload).digest();
  const actual=Buffer.from(signature,"base64url");
  if(expected.length!==actual.length||!timingSafeEqual(expected,actual)) return null;
  try{
    const parsed=JSON.parse(Buffer.from(payload,"base64url").toString("utf8")) as {
      organizationId:string;userId:string;issuedAt:number;
    };
    if(!parsed.organizationId||!parsed.userId||!parsed.issuedAt) return null;
    if(Date.now()-parsed.issuedAt>15*60*1000) return null;
    return parsed;
  }catch{return null;}
}

export function googleCalendarAuthorizationUrl(input:{origin:string;state:string;loginHint?:string|null}){
  const cfg=googleCalendarOAuthConfig(input.origin);
  const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id",cfg.clientId);
  url.searchParams.set("redirect_uri",cfg.redirectUri);
  url.searchParams.set("response_type","code");
  url.searchParams.set("access_type","offline");
  url.searchParams.set("prompt","consent");
  url.searchParams.set("include_granted_scopes","true");
  url.searchParams.set("scope",GOOGLE_CALENDAR_SCOPES.join(" "));
  url.searchParams.set("state",input.state);
  if(input.loginHint?.trim()) url.searchParams.set("login_hint",input.loginHint.trim());
  return url.toString();
}

export function assertGoogleCalendarScopes(grantedScope:string){
  const granted=new Set(grantedScope.split(/\s+/).map((item)=>item.trim()).filter(Boolean));
  const missing=REQUIRED_GOOGLE_CALENDAR_SCOPES.filter((scope)=>!granted.has(scope));
  if(missing.length){
    throw new Error("Google Calendar permissions were not fully granted. Reconnect and approve Calendar access.");
  }
}

export async function exchangeGoogleCalendarCode(input:{origin:string;code:string}){
  const cfg=googleCalendarOAuthConfig(input.origin);
  const response=await fetch("https://oauth2.googleapis.com/token",{
    method:"POST",
    headers:{"content-type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({
      client_id:cfg.clientId,
      client_secret:cfg.clientSecret,
      code:input.code,
      redirect_uri:cfg.redirectUri,
      grant_type:"authorization_code",
    }),
    cache:"no-store",
  });
  const body=await response.json().catch(()=>({})) as Json;
  if(!response.ok) throw new Error(text(body.error_description)||text(body.error)||"Google Calendar authorization failed.");
  const accessToken=text(body.access_token);
  if(!accessToken) throw new Error("Google Calendar authorization returned no access token.");
  return {
    accessToken,
    refreshToken:text(body.refresh_token)||null,
    expiresIn:Number(body.expires_in)||3600,
    scope:text(body.scope),
    tokenType:text(body.token_type)||"Bearer",
  };
}

async function googleApi(accessToken:string,url:string){
  const response=await fetch(url,{
    headers:{accept:"application/json",Authorization:"Bearer "+accessToken},
    cache:"no-store",
  });
  const body=await response.json().catch(()=>({})) as Json;
  if(!response.ok){
    const error=body.error as Json|undefined;
    throw new Error(text(error?.message)||"Google Calendar API request failed.");
  }
  return body;
}

export async function getGoogleConnectedEmail(accessToken:string){
  const body=await googleApi(accessToken,"https://www.googleapis.com/oauth2/v2/userinfo");
  return text(body.email)||null;
}

export async function listWritableGoogleCalendars(accessToken:string):Promise<GoogleCalendarChoice[]>{
  const body=await googleApi(
    accessToken,
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer&showHidden=false",
  );
  const items=Array.isArray(body.items)?body.items as Json[]:[];
  return items.map((item)=>({
    id:text(item.id),
    summary:text(item.summary)||text(item.id)||"Google Calendar",
    primary:item.primary===true,
    accessRole:text(item.accessRole),
    timeZone:text(item.timeZone)||"Africa/Lagos",
  })).filter((item)=>item.id&&["owner","writer"].includes(item.accessRole))
    .sort((a,b)=>Number(b.primary)-Number(a.primary)||a.summary.localeCompare(b.summary));
}

export function platformGoogleCalendarCredentials(){
  const clientId=text(process.env.GOOGLE_CALENDAR_CLIENT_ID||process.env.GOOGLE_OAUTH_CLIENT_ID);
  const clientSecret=text(process.env.GOOGLE_CALENDAR_CLIENT_SECRET||process.env.GOOGLE_OAUTH_CLIENT_SECRET);
  if(!clientId||!clientSecret) throw new Error("Fluxknight Google Calendar OAuth is not configured.");
  return {clientId,clientSecret};
}
