"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CalendarChoice={
  id:string;
  summary:string;
  primary?:boolean;
  accessRole?:string;
  timeZone?:string;
};

export default function GoogleCalendarPanel({
  integration,
  resource,
  canManage,
}:{
  integration:null|{
    id:string;
    status:string;
    configuration?:Record<string,unknown>|null;
    health?:Record<string,unknown>|null;
    last_connected_at?:string|null;
  };
  resource:null|{
    id:string;
    external_calendar_id:string;
    display_name:string;
    organizer_email?:string|null;
    timezone:string;
  };
  canManage:boolean;
}){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const config=(integration?.configuration||{}) as Record<string,unknown>;
  const calendars=Array.isArray(config.available_calendars)
    ? config.available_calendars as CalendarChoice[]
    :[];
  const pending=config.calendar_selection_pending===true;
  const selectedId=resource?.external_calendar_id||String(config.selected_calendar_id||"");
  const [calendarId,setCalendarId]=useState(selectedId||String(calendars.find((item)=>item.primary)?.id||""));
  const connectedEmail=String(config.connected_email||resource?.organizer_email||"");

  async function selectCalendar(calendarId:string){
    setBusy(true);setMessage("");
    try{
      const res=await fetch("/api/integrations/google-calendar/select",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({calendarId}),
      });
      const body=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(body.error||"Unable to select Google Calendar");
      setMessage("Google Calendar is ready.");
      router.refresh();
    }catch(err){setMessage(err instanceof Error?err.message:"Unable to select Google Calendar");}
    finally{setBusy(false);}
  }

  async function disconnect(){
    if(!window.confirm("Disconnect Google Calendar from this Fluxknight workspace?")) return;
    setBusy(true);setMessage("");
    try{
      const res=await fetch("/api/integrations/google-calendar/disconnect",{method:"POST"});
      const body=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(body.error||"Unable to disconnect Google Calendar");
      setMessage("Google Calendar disconnected.");
      router.refresh();
    }catch(err){setMessage(err instanceof Error?err.message:"Unable to disconnect Google Calendar");}
    finally{setBusy(false);}
  }

  return <section className="portal-card">
    <div className="portal-card-head"><div>
      <h2>Google Calendar</h2>
      <p>Connect the Google account your team uses for appointments. Fluxknight never asks you for Google API credentials.</p>
    </div></div>

    {!integration||integration.status==="disconnected"
      ? <div className="portal-list-row">
          <div><strong>Not connected</strong><span>Authorize Google once, then choose the calendar Fluxknight should use.</span></div>
          {canManage?<a href="/api/integrations/google-calendar/connect">Connect Google Calendar</a>:null}
        </div>
      : <>
          <div className="portal-list">
            <div className="portal-list-row"><div><strong>Google account</strong><span>{connectedEmail||"Connected account"}</span></div><em>{integration.status}</em></div>
            {resource?<div className="portal-list-row"><div><strong>Booking calendar</strong><span>{resource.display_name} · {resource.timezone}</span></div><em>ready</em></div>:null}
          </div>

          {(pending||!resource)&&calendars.length
            ? <div className="portal-form-grid" style={{marginTop:16}}>
                <div className="portal-field">
                  <label>Choose booking calendar</label>
                  <select
                    value={calendarId}
                    disabled={!canManage||busy}
                    onChange={(event)=>setCalendarId(event.target.value)}
                  >
                    <option value="" disabled>Select calendar</option>
                    {calendars.map((calendar)=><option key={calendar.id} value={calendar.id}>
                      {calendar.summary}{calendar.primary?" · Primary":""}
                    </option>)}
                  </select>
                </div>
                {canManage?<div><button type="button" disabled={busy||!calendarId} onClick={()=>void selectCalendar(calendarId)}>{busy?"Checking...":"Use this calendar"}</button></div>:null}
              </div>
            : null}

          <div style={{display:"flex",gap:10,marginTop:16,flexWrap:"wrap"}}>
            {canManage?<a href="/api/integrations/google-calendar/connect">Reconnect Google</a>:null}
            {canManage?<button type="button" onClick={()=>void disconnect()} disabled={busy}>Disconnect</button>:null}
          </div>
        </>
    }
    {message?<p className="portal-empty">{message}</p>:null}
  </section>;
}
