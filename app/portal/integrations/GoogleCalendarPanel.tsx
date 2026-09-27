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

type CalendarResource={
  id:string;
  external_calendar_id:string;
  display_name:string;
  organizer_email?:string|null;
  assigned_membership_id?:string|null;
  timezone:string;
  default_duration_minutes:number;
  status:string;
  is_default:boolean;
  availability_configuration?:Record<string,unknown>|null;
};

type Member={
  id:string;
  email?:string|null;
  role:string;
  status:string;
};

const COMMON_TIMEZONES=[
  "Africa/Lagos",
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Singapore",
];

function ResourceEditor({
  resource,
  members,
  busy,
  onSave,
}:{
  resource:CalendarResource;
  members:Member[];
  busy:boolean;
  onSave:(resource:CalendarResource,values:Record<string,unknown>)=>Promise<void>;
}){
  const [membershipId,setMembershipId]=useState(resource.assigned_membership_id||"");
  const [timezone,setTimezone]=useState(resource.timezone||"Africa/Lagos");
  const [duration,setDuration]=useState(String(resource.default_duration_minutes||60));
  const [isDefault,setIsDefault]=useState(resource.is_default);
  const [status,setStatus]=useState(resource.status);

  return <div className="portal-list-row" style={{alignItems:"flex-start"}}>
    <div style={{minWidth:220}}>
      <strong>{resource.display_name}{resource.is_default?" · Default":""}</strong>
      <span>{resource.external_calendar_id}</span>
      <small>{resource.organizer_email||"Connected Google account"}</small>
    </div>
    <div className="portal-form-grid" style={{flex:1,minWidth:280}}>
      <div className="portal-field">
        <label>Assigned staff</label>
        <select value={membershipId} disabled={busy} onChange={(e)=>setMembershipId(e.target.value)}>
          <option value="">Shared / unassigned</option>
          {members.filter((m)=>m.status==="active").map((member)=>
            <option key={member.id} value={member.id}>{member.email||member.id} · {member.role}</option>
          )}
        </select>
      </div>
      <div className="portal-field">
        <label>Timezone</label>
        <input list={"calendar-timezones-"+resource.id} value={timezone} disabled={busy} onChange={(e)=>setTimezone(e.target.value)} />
        <datalist id={"calendar-timezones-"+resource.id}>
          {COMMON_TIMEZONES.map((zone)=><option value={zone} key={zone} />)}
        </datalist>
      </div>
      <div className="portal-field">
        <label>Default duration</label>
        <input type="number" min={5} max={1440} step={5} value={duration} disabled={busy} onChange={(e)=>setDuration(e.target.value)} />
      </div>
      <div className="portal-field">
        <label>Resource status</label>
        <select value={status} disabled={busy} onChange={(e)=>setStatus(e.target.value)}>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>
      <label style={{display:"flex",gap:8,alignItems:"center"}}>
        <input type="checkbox" checked={isDefault} disabled={busy} onChange={(e)=>setIsDefault(e.target.checked)} />
        Default booking calendar
      </label>
      <div>
        <button type="button" disabled={busy||!timezone||!duration} onClick={()=>void onSave(resource,{
          assignedMembershipId:membershipId||null,
          timezone,
          defaultDurationMinutes:Number(duration),
          isDefault,
          status,
        })}>{busy?"Saving...":"Save resource"}</button>
      </div>
    </div>
  </div>;
}

export default function GoogleCalendarPanel({
  integration,
  resource,
  resources,
  members,
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
  resources:CalendarResource[];
  members:Member[];
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
  const health=(integration?.health||{}) as Record<string,unknown>;
  const healthState=String(health.state||integration?.status||"disconnected");
  const healthMessage=String(health.message||"");
  const usedCalendarIds=new Set(resources.map((item)=>item.external_calendar_id));
  const additionalCalendars=calendars.filter((item)=>!usedCalendarIds.has(item.id));
  const [additionalCalendarId,setAdditionalCalendarId]=useState(String(additionalCalendars[0]?.id||""));

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

  async function addResource(){
    if(!additionalCalendarId)return;
    setBusy(true);setMessage("");
    try{
      const res=await fetch("/api/integrations/google-calendar/resources",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({calendarId:additionalCalendarId,isDefault:false}),
      });
      const body=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(body.error||"Unable to add calendar resource");
      setMessage("Calendar resource added. Assign it to a staff member when needed.");
      router.refresh();
    }catch(err){setMessage(err instanceof Error?err.message:"Unable to add calendar resource");}
    finally{setBusy(false);}
  }

  async function saveResource(item:CalendarResource,values:Record<string,unknown>){
    setBusy(true);setMessage("");
    try{
      const res=await fetch(`/api/integrations/google-calendar/resources/${item.id}`,{
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(values),
      });
      const body=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(body.error||"Unable to update calendar resource");
      setMessage("Calendar resource updated.");
      router.refresh();
    }catch(err){setMessage(err instanceof Error?err.message:"Unable to update calendar resource");}
    finally{setBusy(false);}
  }

  async function checkConnection(){
    setBusy(true);setMessage("");
    try{
      const res=await fetch("/api/integrations/google-calendar/readiness",{cache:"no-store"});
      const body=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(body.error||"Unable to verify Google Calendar");
      if(body.state==="selection_required"){
        setMessage("Google is connected. Choose the booking calendar to finish setup.");
      }else if(body.ready){
        setMessage("Google Calendar connection is healthy.");
      }else{
        setMessage("Google Calendar is not ready yet.");
      }
      router.refresh();
    }catch(err){setMessage(err instanceof Error?err.message:"Unable to verify Google Calendar");}
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
            <div className="portal-list-row"><div><strong>Google account</strong><span>{connectedEmail||"Connected account"}</span></div><em>{healthState.replaceAll("_"," ")}</em></div>
            {healthMessage?<div className="portal-list-row"><div><strong>Connection health</strong><span>{healthMessage}</span></div><em>{healthState.replaceAll("_"," ")}</em></div>:null}
            {resource?<div className="portal-list-row"><div><strong>Booking calendar</strong><span>{resource.display_name} · {resource.timezone}</span></div><em>ready</em></div>:null}
          </div>

          {(pending||!resource)&&calendars.length
            ? <div className="portal-form-grid" style={{marginTop:16}}>
                <div className="portal-field">
                  <label>Choose booking calendar</label>
                  <select value={calendarId} disabled={!canManage||busy} onChange={(event)=>setCalendarId(event.target.value)}>
                    <option value="" disabled>Select calendar</option>
                    {calendars.map((calendar)=><option key={calendar.id} value={calendar.id}>
                      {calendar.summary}{calendar.primary?" · Primary":""}
                    </option>)}
                  </select>
                </div>
                {canManage?<div><button type="button" disabled={busy||!calendarId} onClick={()=>void selectCalendar(calendarId)}>{busy?"Checking...":"Use this calendar"}</button></div>:null}
              </div>
            : null}

          {resources.length?<div style={{marginTop:24}}>
            <div className="portal-card-head"><div>
              <h3>Calendar resources</h3>
              <p>Map writable calendars to staff, timezone and appointment duration. Explicit staff routing uses these assignments before the tenant default.</p>
            </div></div>
            <div className="portal-list">
              {resources.map((item)=><ResourceEditor key={item.id} resource={item} members={members} busy={busy} onSave={saveResource} />)}
            </div>
          </div>:null}

          {canManage&&additionalCalendars.length?<div className="portal-form-grid" style={{marginTop:18}}>
            <div className="portal-field">
              <label>Add another staff calendar</label>
              <select value={additionalCalendarId} disabled={busy} onChange={(e)=>setAdditionalCalendarId(e.target.value)}>
                {additionalCalendars.map((calendar)=><option key={calendar.id} value={calendar.id}>
                  {calendar.summary}{calendar.primary?" · Primary":""}
                </option>)}
              </select>
            </div>
            <div><button type="button" disabled={busy||!additionalCalendarId} onClick={()=>void addResource()}>{busy?"Adding...":"Add calendar resource"}</button></div>
          </div>:null}

          <div style={{display:"flex",gap:10,marginTop:16,flexWrap:"wrap"}}>
            {canManage?<button type="button" onClick={()=>void checkConnection()} disabled={busy}>{busy?"Checking...":"Check connection"}</button>:null}
            {canManage?<a href="/api/integrations/google-calendar/connect">Reconnect Google</a>:null}
            {canManage?<button type="button" onClick={()=>void disconnect()} disabled={busy}>Disconnect</button>:null}
          </div>
        </>
    }
    {message?<p className="portal-empty">{message}</p>:null}
  </section>;
}
