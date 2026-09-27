"use client";

import { useState } from "react";

type Settings={
  timezone:string;
  availability_configuration?:Record<string,unknown>|null;
};

const TIMEZONES=[
  "Africa/Lagos","UTC","Europe/London","Europe/Paris",
  "America/New_York","America/Chicago","America/Los_Angeles",
  "Asia/Dubai","Asia/Singapore",
];

export default function BusinessAvailabilityEditor({
  settings,busy,onSave,
}:{
  settings:Settings;
  busy:boolean;
  onSave:(values:{timezone:string;availabilityConfiguration:Record<string,unknown>})=>Promise<void>;
}){
  const availability=(settings.availability_configuration||{}) as Record<string,unknown>;
  const configuredWorking=(availability.workingHours||{}) as Record<string,unknown>;
  const configuredBreaks=(availability.breaks||{}) as Record<string,unknown>;
  const [timezone,setTimezone]=useState(settings.timezone||"Africa/Lagos");
  const [enabled,setEnabled]=useState(Object.keys(configuredWorking).length>0);
  const [workingDays,setWorkingDays]=useState<string[]>(
    Object.keys(configuredWorking).length?Object.keys(configuredWorking):["mon","tue","wed","thu","fri"]
  );
  const firstWorking=(Object.values(configuredWorking)[0] as Array<{start?:string;end?:string}>|undefined)?.[0];
  const firstBreak=(Object.values(configuredBreaks)[0] as Array<{start?:string;end?:string}>|undefined)?.[0];
  const [workStart,setWorkStart]=useState(firstWorking?.start||"09:00");
  const [workEnd,setWorkEnd]=useState(firstWorking?.end||"17:00");
  const [breakStart,setBreakStart]=useState(firstBreak?.start||"");
  const [breakEnd,setBreakEnd]=useState(firstBreak?.end||"");
  const [notice,setNotice]=useState(String(availability.minimumNoticeMinutes??0));
  const [advance,setAdvance]=useState(String(availability.maximumAdvanceDays??30));
  const [bufferBefore,setBufferBefore]=useState(String(availability.bufferBeforeMinutes??0));
  const [bufferAfter,setBufferAfter]=useState(String(availability.bufferAfterMinutes??0));
  const [blockedDates,setBlockedDates]=useState(
    Array.isArray(availability.blockedDates)?(availability.blockedDates as string[]).join(", "):""
  );
  const serviceDurations=(availability.serviceDurations||{}) as Record<string,unknown>;
  const [durations,setDurations]=useState(
    Object.entries(serviceDurations).map(([key,value])=>`${key}=${value}`).join(", ")
  );

  function toggleDay(day:string){
    setWorkingDays((current)=>current.includes(day)?current.filter((item)=>item!==day):[...current,day]);
  }

  function build(){
    if(enabled&&workEnd<=workStart) throw new Error("Business closing time must be after opening time.");
    if(breakStart&&breakEnd&&breakEnd<=breakStart) throw new Error("Break end must be after break start.");
    const workingHours:Record<string,Array<{start:string;end:string}>>={};
    const breaks:Record<string,Array<{start:string;end:string}>>={};
    if(enabled){
      for(const day of workingDays) workingHours[day]=[{start:workStart,end:workEnd}];
      if(breakStart&&breakEnd){
        for(const day of workingDays) breaks[day]=[{start:breakStart,end:breakEnd}];
      }
    }
    const serviceDurations:Record<string,number>={};
    for(const pair of durations.split(",")){
      const [key,value]=pair.split("=").map((item)=>item.trim());
      const minutes=Number(value);
      if(key&&Number.isFinite(minutes)&&minutes>=5) serviceDurations[key.toLowerCase()]=Math.min(1440,Math.round(minutes));
    }
    return {
      ...(enabled?{workingHours}:{}),
      ...(enabled&&Object.keys(breaks).length?{breaks}:{}),
      blockedDates:blockedDates.split(",").map((item)=>item.trim()).filter(Boolean),
      minimumNoticeMinutes:Math.max(0,Number(notice)||0),
      maximumAdvanceDays:Math.max(1,Number(advance)||30),
      bufferBeforeMinutes:Math.max(0,Number(bufferBefore)||0),
      bufferAfterMinutes:Math.max(0,Number(bufferAfter)||0),
      serviceDurations,
    };
  }

  return <div className="portal-form-grid">
    <div className="portal-field"><label>Business timezone</label>
      <input list="business-timezones" value={timezone} disabled={busy} onChange={(e)=>setTimezone(e.target.value)} />
      <datalist id="business-timezones">{TIMEZONES.map((zone)=><option value={zone} key={zone} />)}</datalist>
    </div>
    <label style={{display:"flex",gap:8,alignItems:"center"}}>
      <input type="checkbox" checked={enabled} disabled={busy} onChange={(e)=>setEnabled(e.target.checked)} />
      Enforce business hours
    </label>
    {enabled?<div className="portal-field"><label>Business days</label>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {["mon","tue","wed","thu","fri","sat","sun"].map((day)=><label key={day} style={{display:"flex",gap:4,alignItems:"center"}}>
          <input type="checkbox" checked={workingDays.includes(day)} disabled={busy} onChange={()=>toggleDay(day)} />{day.toUpperCase()}
        </label>)}
      </div>
    </div>:null}
    {enabled?<div className="portal-field"><label>Opening hours</label><div style={{display:"flex",gap:8}}>
      <input type="time" value={workStart} disabled={busy} onChange={(e)=>setWorkStart(e.target.value)} />
      <input type="time" value={workEnd} disabled={busy} onChange={(e)=>setWorkEnd(e.target.value)} />
    </div></div>:null}
    {enabled?<div className="portal-field"><label>Business break</label><div style={{display:"flex",gap:8}}>
      <input type="time" value={breakStart} disabled={busy} onChange={(e)=>setBreakStart(e.target.value)} />
      <input type="time" value={breakEnd} disabled={busy} onChange={(e)=>setBreakEnd(e.target.value)} />
    </div></div>:null}
    <div className="portal-field"><label>Minimum booking notice (minutes)</label><input type="number" min={0} max={10080} value={notice} disabled={busy} onChange={(e)=>setNotice(e.target.value)} /></div>
    <div className="portal-field"><label>Maximum advance booking (days)</label><input type="number" min={1} max={365} value={advance} disabled={busy} onChange={(e)=>setAdvance(e.target.value)} /></div>
    <div className="portal-field"><label>Default buffer before (minutes)</label><input type="number" min={0} max={1440} value={bufferBefore} disabled={busy} onChange={(e)=>setBufferBefore(e.target.value)} /></div>
    <div className="portal-field"><label>Default buffer after (minutes)</label><input type="number" min={0} max={1440} value={bufferAfter} disabled={busy} onChange={(e)=>setBufferAfter(e.target.value)} /></div>
    <div className="portal-field"><label>Closed / holiday dates</label><input value={blockedDates} disabled={busy} onChange={(e)=>setBlockedDates(e.target.value)} placeholder="2026-12-25, 2027-01-01" /></div>
    <div className="portal-field"><label>Default service durations</label><input value={durations} disabled={busy} onChange={(e)=>setDurations(e.target.value)} placeholder="inspection=60, consultation=30" /></div>
    <div><button type="button" disabled={busy||!timezone||(enabled&&!workingDays.length)} onClick={()=>{
      try{void onSave({timezone,availabilityConfiguration:build()});}
      catch(error){window.alert(error instanceof Error?error.message:"Invalid business availability settings");}
    }}>{busy?"Saving...":"Save business availability"}</button></div>
  </div>;
}
