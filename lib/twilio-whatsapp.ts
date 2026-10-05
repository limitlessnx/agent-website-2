import { createHmac, timingSafeEqual } from "node:crypto";

type Json=Record<string,unknown>;

export type TwilioSubaccount={
  sid:string;
  authToken:string;
  friendlyName:string;
};

export type TwilioSender={
  sid:string;
  status:string;
  senderId:string;
  configuration?:Json|null;
  webhook?:Json|null;
  profile?:Json|null;
  properties?:Json|null;
};

function env(name:string){
  return String(process.env[name]||"").trim();
}

function parentCredentials(){
  const accountSid=env("TWILIO_ACCOUNT_SID");
  const apiKey=env("TWILIO_API_KEY");
  const apiSecret=env("TWILIO_API_SECRET");
  if(!accountSid||!apiKey||!apiSecret) throw new Error("Twilio parent account API credentials are not configured.");
  return {accountSid,apiKey,apiSecret};
}

export function twilioTechProviderConfig(){
  const appId=env("META_APP_ID")||env("NEXT_PUBLIC_META_APP_ID");
  const configId=env("META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID");
  const solutionId=env("TWILIO_WHATSAPP_PARTNER_SOLUTION_ID");
  return {
    appId,configId,solutionId,
    configured:Boolean(appId&&configId&&solutionId&&env("TWILIO_ACCOUNT_SID")&&env("TWILIO_API_KEY")&&env("TWILIO_API_SECRET")),
  };
}

function basic(accountSid:string,authToken:string){
  return "Basic "+Buffer.from(`${accountSid}:${authToken}`).toString("base64");
}

async function jsonResponse(response:Response){
  const body=await response.json().catch(()=>({})) as Json;
  if(!response.ok){
    const message=String(body.message||body.error_message||body.error||`Twilio returned ${response.status}`);
    const error=new Error(message) as Error&{status?:number;code?:string;response?:Json};
    error.status=response.status;
    error.code=body.code!=null?String(body.code):undefined;
    error.response=body;
    throw error;
  }
  return body;
}

export async function createTwilioSubaccount(friendlyName:string):Promise<TwilioSubaccount>{
  const parent=parentCredentials();
  const response=await fetch("https://api.twilio.com/2010-04-01/Accounts.json",{
    method:"POST",
    headers:{
      Authorization:basic(parent.apiKey,parent.apiSecret),
      "Content-Type":"application/x-www-form-urlencoded",
    },
    body:new URLSearchParams({FriendlyName:friendlyName.slice(0,64)}),
    cache:"no-store",
  });
  const body=await jsonResponse(response);
  const sid=String(body.sid||"");
  const authToken=String(body.auth_token||"");
  if(!sid||!authToken) throw new Error("Twilio created a subaccount without returning its credentials.");
  return {sid,authToken,friendlyName:String(body.friendly_name||friendlyName)};
}

export async function registerTwilioWhatsAppSender(input:{
  accountSid:string;
  authToken:string;
  phoneE164:string;
  wabaId:string;
  profileName:string;
  callbackUrl:string;
  fallbackUrl:string;
  statusCallbackUrl:string;
  numberSource:"customer"|"twilio_sms"|"twilio_voice";
}):Promise<TwilioSender>{
  const senderId=`whatsapp:${input.phoneE164}`;
  const configuration:Json={
    waba_id:input.wabaId,
    account_type:"ISVSubAccount",
  };
  if(input.numberSource==="customer") configuration.verification_method="sms";
  const response=await fetch("https://messaging.twilio.com/v2/Channels/Senders",{
    method:"POST",
    headers:{
      Authorization:basic(input.accountSid,input.authToken),
      "Content-Type":"application/json",
      Accept:"application/json",
    },
    body:JSON.stringify({
      sender_id:senderId,
      configuration,
      webhook:{
        callback_url:input.callbackUrl,
        callback_method:"POST",
        fallback_url:input.fallbackUrl,
        fallback_method:"POST",
        status_callback_url:input.statusCallbackUrl,
        status_callback_method:"POST",
      },
      profile:{name:input.profileName},
    }),
    cache:"no-store",
  });
  const body=await jsonResponse(response);
  return {
    sid:String(body.sid||""),
    status:String(body.status||""),
    senderId:String(body.sender_id||senderId),
    configuration:(body.configuration||null) as Json|null,
    webhook:(body.webhook||null) as Json|null,
    profile:(body.profile||null) as Json|null,
    properties:(body.properties||null) as Json|null,
  };
}

export async function getTwilioWhatsAppSender(input:{
  accountSid:string;
  authToken:string;
  senderSid:string;
}):Promise<TwilioSender>{
  const response=await fetch(`https://messaging.twilio.com/v2/Channels/Senders/${encodeURIComponent(input.senderSid)}`,{
    headers:{Authorization:basic(input.accountSid,input.authToken),Accept:"application/json"},
    cache:"no-store",
  });
  const body=await jsonResponse(response);
  return {
    sid:String(body.sid||input.senderSid),
    status:String(body.status||""),
    senderId:String(body.sender_id||""),
    configuration:(body.configuration||null) as Json|null,
    webhook:(body.webhook||null) as Json|null,
    profile:(body.profile||null) as Json|null,
    properties:(body.properties||null) as Json|null,
  };
}

export async function sendTwilioWhatsAppMessage(input:{
  accountSid:string;
  authToken:string;
  from:string;
  to:string;
  body?:string;
  contentSid?:string|null;
  contentVariables?:Record<string,string|number|null|undefined>;
  mediaUrl?:string|null;
  statusCallbackUrl?:string|null;
}){
  const params=new URLSearchParams();
  params.set("To",input.to.startsWith("whatsapp:")?input.to:`whatsapp:${input.to}`);
  params.set("From",input.from.startsWith("whatsapp:")?input.from:`whatsapp:${input.from}`);
  if(input.contentSid){
    params.set("ContentSid",input.contentSid);
    if(input.contentVariables) params.set("ContentVariables",JSON.stringify(input.contentVariables));
  }else if(input.body){
    params.set("Body",input.body);
  }
  if(input.mediaUrl) params.append("MediaUrl",input.mediaUrl);
  if(input.statusCallbackUrl) params.set("StatusCallback",input.statusCallbackUrl);

  const response=await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(input.accountSid)}/Messages.json`,
    {
      method:"POST",
      headers:{
        Authorization:basic(input.accountSid,input.authToken),
        "Content-Type":"application/x-www-form-urlencoded",
      },
      body:params,
      cache:"no-store",
    },
  );
  const result=await jsonResponse(response);
  return {
    sid:String(result.sid||""),
    status:String(result.status||"queued"),
    raw:result,
  };
}

export function normalizeTwilioWhatsAppAddress(value:string){
  return String(value||"").replace(/^whatsapp:/i,"").trim();
}

export function validateTwilioFormSignature(input:{
  authToken:string;
  signature:string|null;
  url:string;
  params:URLSearchParams;
}){
  if(!input.authToken||!input.signature) return false;
  const pairs:Array<[string,string]>=[];
  for(const key of Array.from(new Set(Array.from(input.params.keys()))).sort()){
    const values=input.params.getAll(key);
    for(const value of values) pairs.push([key,value]);
  }
  let payload=input.url;
  for(const [key,value] of pairs) payload+=key+value;
  const expected=createHmac("sha1",input.authToken).update(payload).digest("base64");
  const supplied=input.signature;
  if(expected.length!==supplied.length) return false;
  return timingSafeEqual(Buffer.from(expected),Buffer.from(supplied));
}


export async function deleteTwilioWhatsAppSender(input:{
  accountSid:string;
  authToken:string;
  senderSid:string;
}){
  const response=await fetch(
    `https://messaging.twilio.com/v2/Channels/Senders/${encodeURIComponent(input.senderSid)}`,
    {
      method:"DELETE",
      headers:{Authorization:basic(input.accountSid,input.authToken),Accept:"application/json"},
      cache:"no-store",
    },
  );
  if(response.status===204)return {ok:true};
  if(response.status===404)return {ok:true,alreadyDeleted:true};
  await jsonResponse(response);
  return {ok:true};
}


export type TwilioParentAccount={
  sid:string;
  friendlyName:string;
  status:string;
  type:string;
};

export async function getTwilioParentAccount():Promise<TwilioParentAccount>{
  const parent=parentCredentials();
  const response=await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(parent.accountSid)}.json`,
    {
      method:"GET",
      headers:{Authorization:basic(parent.apiKey,parent.apiSecret),Accept:"application/json"},
      cache:"no-store",
    },
  );
  const body=await jsonResponse(response);
  return {
    sid:String(body.sid||parent.accountSid),
    friendlyName:String(body.friendly_name||""),
    status:String(body.status||""),
    type:String(body.type||""),
  };
};
