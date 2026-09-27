"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    FB?: {
      init:(options:Record<string,unknown>)=>void;
      login:(callback:(response:unknown)=>void,options:Record<string,unknown>)=>void;
    };
    fbAsyncInit?:()=>void;
  }
}

type Binding={
  status:string;
  sender_phone_e164?:string|null;
  sender_profile_name?:string|null;
  twilio_sender_status?:string|null;
  twilio_sender_sid?:string|null;
  meta_waba_id?:string|null;
  last_error_message?:string|null;
};

type Bootstrap={
  sessionId:string;
  appId:string;
  configId:string;
  solutionId:string;
  featureType:string|null;
};

function loadFacebookSdk(appId:string){
  return new Promise<void>((resolve,reject)=>{
    if(window.FB){
      window.FB.init({appId,cookie:true,xfbml:false,version:"v23.0"});
      resolve();
      return;
    }
    const existing=document.getElementById("facebook-jssdk");
    window.fbAsyncInit=()=>{
      window.FB?.init({appId,cookie:true,xfbml:false,version:"v23.0"});
      resolve();
    };
    if(existing) return;
    const script=document.createElement("script");
    script.id="facebook-jssdk";
    script.async=true;
    script.defer=true;
    script.crossOrigin="anonymous";
    script.src="https://connect.facebook.net/en_US/sdk.js";
    script.onerror=()=>reject(new Error("Unable to load Meta Embedded Signup."));
    document.body.appendChild(script);
  });
}

export default function TwilioWhatsAppOnboardingPanel({
  initialBinding,
  canManage,
}:{
  initialBinding:Binding|null;
  canManage:boolean;
}){
  const router=useRouter();
  const [binding,setBinding]=useState<Binding|null>(initialBinding);
  const [phone,setPhone]=useState(initialBinding?.sender_phone_e164||"");
  const [profileName,setProfileName]=useState(initialBinding?.sender_profile_name||"");
  const [numberSource,setNumberSource]=useState<"customer"|"twilio_sms"|"twilio_voice">("customer");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const bootstrapRef=useRef<Bootstrap|null>(null);

  useEffect(()=>{
    const listener=(event:MessageEvent)=>{
      if(!event.origin.endsWith("facebook.com")) return;
      let data:any;
      try{data=typeof event.data==="string"?JSON.parse(event.data):event.data;}catch{return;}
      if(data?.type!=="WA_EMBEDDED_SIGNUP") return;
      if(data.event==="CANCEL"){
        setBusy(false);
        setMessage(`WhatsApp onboarding was cancelled${data.data?.current_step?` at ${data.data.current_step}`:""}.`);
        return;
      }
      if(data.event==="ERROR"){
        setBusy(false);
        setError(String(data.data?.error_message||"Meta Embedded Signup failed."));
        return;
      }
      if(data.event!=="FINISH"&&data.event!=="FINISH_ONLY_WABA") return;
      const bootstrap=bootstrapRef.current;
      if(!bootstrap) return;
      const wabaId=String(data.data?.waba_id||"");
      const metaPhoneNumberId=String(data.data?.phone_number_id||"");
      void complete(bootstrap.sessionId,wabaId,metaPhoneNumberId);
    };
    window.addEventListener("message",listener);
    return()=>window.removeEventListener("message",listener);
  },[phone,profileName]);

  useEffect(()=>{
    const status=String(binding?.status||"");
    if(!["awaiting_sender_online","registering_sender","provisioning_subaccount"].includes(status))return;
    const timer=window.setInterval(()=>{void refreshStatus(true);},15000);
    return()=>window.clearInterval(timer);
  },[binding?.status]);

  async function complete(sessionId:string,wabaId:string,metaPhoneNumberId:string){
    setBusy(true);setError("");setMessage("Creating your WhatsApp sender in Twilio...");
    try{
      const response=await fetch("/api/integrations/whatsapp/twilio/complete",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          sessionId,wabaId,metaPhoneNumberId,
          senderPhoneE164:phone,
          senderProfileName:profileName,
        }),
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(body.error||"Unable to register WhatsApp sender.");
      setBinding(body.binding||null);
      setMessage(body.binding?.status==="connected"
        ?"WhatsApp is connected and ready."
        :"Meta signup is complete. Twilio is registering the sender; this can take a few minutes.");
      router.refresh();
    }catch(err){
      setError(err instanceof Error?err.message:"Unable to complete WhatsApp onboarding.");
    }finally{setBusy(false);}
  }

  async function start(){
    setBusy(true);setError("");setMessage("");
    try{
      if(!/^\+[1-9]\d{7,14}$/.test(phone.replace(/\s+/g,""))){
        throw new Error("Enter the WhatsApp number in E.164 format, for example +2348012345678.");
      }
      if(!profileName.trim()) throw new Error("Enter the WhatsApp business display name.");
      const response=await fetch("/api/integrations/whatsapp/twilio/bootstrap",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          numberSource,
          senderPhoneE164:phone,
          senderProfileName:profileName,
        }),
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(body.error||"Unable to start WhatsApp onboarding.");
      const bootstrap=body as Bootstrap;
      bootstrapRef.current=bootstrap;
      await loadFacebookSdk(bootstrap.appId);
      if(!window.FB) throw new Error("Meta SDK did not initialize.");
      setMessage("Complete the Meta WhatsApp setup in the popup.");
      window.FB.login(
        ()=>undefined,
        {
          config_id:bootstrap.configId,
          auth_type:"rerequest",
          response_type:"code",
          override_default_response_type:true,
          extras:{
            sessionInfoVersion:3,
            ...(bootstrap.featureType?{featureType:bootstrap.featureType}:{}),
            setup:{solutionID:bootstrap.solutionId},
          },
        },
      );
    }catch(err){
      setBusy(false);
      setError(err instanceof Error?err.message:"Unable to start WhatsApp onboarding.");
    }
  }

  async function refreshStatus(silent=false){
    if(!silent)setBusy(true);
    if(!silent){setError("");setMessage("");}
    try{
      const response=await fetch("/api/integrations/whatsapp/twilio/status",{cache:"no-store"});
      const body=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(body.error||"Unable to check sender status.");
      setBinding(body.binding||null);
      if(!silent)setMessage(body.status==="connected"?"WhatsApp sender is online.":"Twilio is still preparing the WhatsApp sender.");
      router.refresh();
    }catch(err){if(!silent)setError(err instanceof Error?err.message:"Unable to check WhatsApp status.");}
    finally{if(!silent)setBusy(false);}
  }

  async function disconnect(){
    if(!window.confirm("Disconnect WhatsApp from this Fluxknight workspace? This removes the Twilio sender but keeps customer history."))return;
    setBusy(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/integrations/whatsapp/twilio/disconnect",{method:"POST"});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error||"Unable to disconnect WhatsApp.");
      setBinding({...binding,status:"disconnected",twilio_sender_status:"OFFLINE"});
      setMessage("WhatsApp disconnected. You can reconnect this workspace at any time.");
      router.refresh();
    }catch(err){setError(err instanceof Error?err.message:"Unable to disconnect WhatsApp.");}
    finally{setBusy(false);}
  }

  const status=String(binding?.status||"not_started");
  const connected=status==="connected";
  return <section className="portal-card">
    <div className="portal-card-head"><div>
      <h2>WhatsApp</h2>
      <p>Connect your WhatsApp Business account through Fluxknight. Meta authorization and Twilio sender registration are handled as one onboarding flow.</p>
    </div><em>{connected?"ready":status.replaceAll("_"," ")}</em></div>

    <div className="portal-list">
      <div className="portal-list-row"><div><strong>Provider</strong><span>Twilio · Meta Tech Provider onboarding</span></div><em>managed</em></div>
      <div className="portal-list-row"><div><strong>WhatsApp number</strong><span>{binding?.sender_phone_e164||"Not connected yet"}</span></div><em>{binding?.twilio_sender_status||"pending"}</em></div>
      {binding?.meta_waba_id?<div className="portal-list-row"><div><strong>Business account</strong><span>Meta WABA connected</span></div><em>linked</em></div>:null}
      {binding?.last_error_message?<div className="portal-list-row"><div><strong>Needs attention</strong><span>{binding.last_error_message}</span></div><em>error</em></div>:null}
    </div>

    {canManage&&!connected?<div className="portal-form-grid" style={{marginTop:18}}>
      <div className="portal-field"><label>WhatsApp phone number</label>
        <input value={phone} onChange={(e)=>setPhone(e.target.value)} disabled={busy} placeholder="+2348012345678" />
      </div>
      <div className="portal-field"><label>Business display name</label>
        <input value={profileName} onChange={(e)=>setProfileName(e.target.value)} disabled={busy} placeholder="Company name" />
      </div>
      <div className="portal-field"><label>Phone number source</label>
        <select value={numberSource} onChange={(e)=>setNumberSource(e.target.value as typeof numberSource)} disabled={busy}>
          <option value="customer">Existing / customer-owned number</option>
          <option value="twilio_sms">Twilio SMS-capable number</option>
          <option value="twilio_voice">Twilio voice-only number</option>
        </select>
      </div>
      <div><button type="button" onClick={()=>void start()} disabled={busy}>{busy?"Connecting...":"Connect WhatsApp with Meta"}</button></div>
    </div>:null}

    {canManage&&binding&&["awaiting_sender_online","registering_sender","provisioning_subaccount","degraded"].includes(status)
      ?<div style={{marginTop:16,display:"flex",gap:10,flexWrap:"wrap"}}>
        <button type="button" onClick={()=>void refreshStatus(false)} disabled={busy}>{busy?"Checking...":"Check sender status"}</button>
        <button type="button" onClick={()=>void disconnect()} disabled={busy}>Disconnect WhatsApp</button>
      </div>
      :null}
    {canManage&&connected?<div style={{marginTop:16}}>
      <button type="button" onClick={()=>void disconnect()} disabled={busy}>Disconnect WhatsApp</button>
    </div>:null}

    {message?<p className="portal-empty">{message}</p>:null}
    {error?<p className="portal-empty">{error}</p>:null}
  </section>;
}
