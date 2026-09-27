import { createAdminClient } from "@/lib/supabase/admin";
import { calendarSlotAvailable, type CalendarResource } from "@/lib/calendar-provider";

type Json=Record<string,unknown>;
type Window={start:string;end:string};
type DayWindows=Record<string,Window[]>;

export type AvailabilityConfiguration={
  workingHours?:DayWindows;
  breaks?:DayWindows;
  blockedDates?:string[];
  minimumNoticeMinutes?:number;
  maximumAdvanceDays?:number;
  bufferBeforeMinutes?:number;
  bufferAfterMinutes?:number;
  serviceDurations?:Record<string,number>;
};

export type RoutingStrategy="default"|"least_busy"|"round_robin";

export type RoutingRequest={
  organizationId:string;
  startAt:string;
  requestedEndAt?:string|null;
  requestedDurationMinutes?:number|null;
  requestedResourceId?:string|null;
  requestedMembershipId?:string|null;
  serviceKey?:string|null;
  branchKey?:string|null;
  departmentKey?:string|null;
  excludeAppointmentId?:string|null;
};

export type RoutingDecision={
  resource:CalendarResource|null;
  startAt:string;
  endAt:string|null;
  available:boolean;
  status:"selected"|"no_resource"|"unavailable";
  strategy:RoutingStrategy;
  reason?:string|null;
  checkedResourceIds:string[];
};

type LocalParts={
  date:string;
  weekday:string;
  minutes:number;
};

function text(value:unknown){
  return typeof value==="string"?value.trim():"";
}
function number(value:unknown,fallback:number){
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed:fallback;
}
function normalizeKey(value:unknown){
  return text(value).toLowerCase();
}
function toIso(value:string){
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) throw new Error("Invalid appointment date.");
  return d.toISOString();
}
function addMinutes(iso:string,minutes:number){
  return new Date(new Date(iso).getTime()+minutes*60_000).toISOString();
}
function durationFor(resource:CalendarResource,serviceKey:string|null,requested?:number|null){
  if(requested&&Number.isFinite(requested)) return Math.max(5,Math.min(1440,Math.round(requested)));
  const config=(resource.availability_configuration||{}) as AvailabilityConfiguration;
  if(serviceKey&&config.serviceDurations&&Number(config.serviceDurations[serviceKey])){
    return Math.max(5,Math.min(1440,Math.round(Number(config.serviceDurations[serviceKey]))));
  }
  return Math.max(5,Math.min(1440,Number(resource.default_duration_minutes)||60));
}
function localParts(iso:string,timeZone:string):LocalParts{
  const date=new Date(iso);
  const formatter=new Intl.DateTimeFormat("en-CA",{
    timeZone,
    year:"numeric",month:"2-digit",day:"2-digit",
    weekday:"short",hour:"2-digit",minute:"2-digit",
    hourCycle:"h23",
  });
  const parts=Object.fromEntries(formatter.formatToParts(date).map((p)=>[p.type,p.value]));
  const weekday=String(parts.weekday||"").slice(0,3).toLowerCase();
  const yyyy=String(parts.year||"");
  const mm=String(parts.month||"");
  const dd=String(parts.day||"");
  const hour=Number(parts.hour||0);
  const minute=Number(parts.minute||0);
  return {date:`${yyyy}-${mm}-${dd}`,weekday,minutes:hour*60+minute};
}
function windowMinutes(raw:string){
  const match=/^(\d{2}):(\d{2})$/.exec(raw);
  if(!match) return null;
  const h=Number(match[1]),m=Number(match[2]);
  if(h<0||h>23||m<0||m>59) return null;
  return h*60+m;
}
function insideWindow(start:number,end:number,window:Window){
  const from=windowMinutes(window.start);
  const to=windowMinutes(window.end);
  if(from===null||to===null||to<=from) return false;
  return start>=from&&end<=to;
}
function overlapsWindow(start:number,end:number,window:Window){
  const from=windowMinutes(window.start);
  const to=windowMinutes(window.end);
  if(from===null||to===null||to<=from) return false;
  return start<to&&end>from;
}

export function evaluateAvailabilityPolicy(input:{
  resource:CalendarResource;
  startAt:string;
  endAt:string;
  now?:Date;
}):{available:boolean;reason?:string}{
  const start=toIso(input.startAt);
  const end=toIso(input.endAt);
  if(new Date(end).getTime()<=new Date(start).getTime()){
    return {available:false,reason:"Appointment end must be after start."};
  }

  const config=(input.resource.availability_configuration||{}) as AvailabilityConfiguration;
  const now=input.now||new Date();
  const notice=Math.max(0,number(config.minimumNoticeMinutes,0));
  if(new Date(start).getTime()<now.getTime()+notice*60_000){
    return {available:false,reason:"Requested time does not meet the minimum booking notice."};
  }

  const maximumDays=Math.max(1,number(config.maximumAdvanceDays,365));
  if(new Date(start).getTime()>now.getTime()+maximumDays*86_400_000){
    return {available:false,reason:"Requested time is beyond the maximum advance booking window."};
  }

  const startLocal=localParts(start,input.resource.timezone);
  const endLocal=localParts(end,input.resource.timezone);
  if(startLocal.date!==endLocal.date){
    return {available:false,reason:"Appointments must fit within one local working day."};
  }

  if(Array.isArray(config.blockedDates)&&config.blockedDates.includes(startLocal.date)){
    return {available:false,reason:"Requested date is blocked."};
  }

  const working=config.workingHours?.[startLocal.weekday];
  if(config.workingHours&&(!Array.isArray(working)||!working.some((w)=>insideWindow(startLocal.minutes,endLocal.minutes,w)))){
    return {available:false,reason:"Requested time is outside staff working hours."};
  }

  const breaks=config.breaks?.[startLocal.weekday]||[];
  if(Array.isArray(breaks)&&breaks.some((w)=>overlapsWindow(startLocal.minutes,endLocal.minutes,w))){
    return {available:false,reason:"Requested time overlaps a staff break."};
  }

  return {available:true};
}

async function hasFluxknightOverlap(input:{
  organizationId:string;
  resourceId:string;
  startAt:string;
  endAt:string;
  excludeAppointmentId?:string|null;
}){
  let query=createAdminClient()
    .from("appointments")
    .select("id",{count:"exact",head:true})
    .eq("organization_id",input.organizationId)
    .eq("calendar_resource_id",input.resourceId)
    .in("status",["pending_availability","confirmed","rescheduled"])
    .lt("start_at",input.endAt)
    .gt("end_at",input.startAt);
  if(input.excludeAppointmentId) query=query.neq("id",input.excludeAppointmentId);
  const {count,error}=await query;
  if(error) throw error;
  return (count||0)>0;
}

export async function evaluateResourceAvailability(input:{
  organizationId:string;
  resource:CalendarResource;
  startAt:string;
  endAt:string;
  excludeAppointmentId?:string|null;
}){
  const policy=evaluateAvailabilityPolicy({
    resource:input.resource,
    startAt:input.startAt,
    endAt:input.endAt,
  });
  if(!policy.available) return policy;

  const config=(input.resource.availability_configuration||{}) as AvailabilityConfiguration;
  const bufferedStart=addMinutes(input.startAt,-Math.max(0,number(config.bufferBeforeMinutes,0)));
  const bufferedEnd=addMinutes(input.endAt,Math.max(0,number(config.bufferAfterMinutes,0)));

  if(await hasFluxknightOverlap({
    organizationId:input.organizationId,
    resourceId:input.resource.id,
    startAt:bufferedStart,
    endAt:bufferedEnd,
    excludeAppointmentId:input.excludeAppointmentId,
  })){
    return {available:false,reason:"Requested time conflicts with another Fluxknight appointment or buffer."};
  }

  const googleAvailable=await calendarSlotAvailable({
    organizationId:input.organizationId,
    resource:input.resource,
    startAt:bufferedStart,
    endAt:bufferedEnd,
  });
  if(!googleAvailable){
    return {available:false,reason:"Requested time conflicts with the connected calendar or appointment buffer."};
  }
  return {available:true};
}

async function routingSettings(organizationId:string){
  const {data,error}=await createAdminClient()
    .from("appointment_routing_settings")
    .select("strategy,fallback_to_default,lookahead_days")
    .eq("organization_id",organizationId)
    .maybeSingle();
  if(error) throw error;
  return {
    strategy:(data?.strategy||"default") as RoutingStrategy,
    fallbackToDefault:data?.fallback_to_default!==false,
    lookaheadDays:Number(data?.lookahead_days)||30,
  };
}

function tagMatch(resource:CalendarResource,request:RoutingRequest){
  const service=normalizeKey(request.serviceKey);
  const branch=normalizeKey(request.branchKey);
  const department=normalizeKey(request.departmentKey);
  const serviceKeys=Array.isArray(resource.service_keys)?resource.service_keys.map(normalizeKey):[];
  if(service&&serviceKeys.length&&!serviceKeys.includes(service)) return false;
  if(branch&&resource.branch_key&&normalizeKey(resource.branch_key)!==branch) return false;
  if(department&&resource.department_key&&normalizeKey(resource.department_key)!==department) return false;
  return true;
}

function specificity(resource:CalendarResource,request:RoutingRequest){
  let score=0;
  const service=normalizeKey(request.serviceKey);
  const branch=normalizeKey(request.branchKey);
  const department=normalizeKey(request.departmentKey);
  if(service&&Array.isArray(resource.service_keys)&&resource.service_keys.map(normalizeKey).includes(service)) score+=4;
  if(branch&&normalizeKey(resource.branch_key)===branch) score+=2;
  if(department&&normalizeKey(resource.department_key)===department) score+=2;
  if(resource.is_default) score+=1;
  return score;
}

async function loadCandidateResources(request:RoutingRequest){
  const admin=createAdminClient();
  if(request.requestedResourceId){
    const {data,error}=await admin.from("appointment_calendar_resources")
      .select("*")
      .eq("organization_id",request.organizationId)
      .eq("id",request.requestedResourceId)
      .eq("status","active")
      .maybeSingle();
    if(error) throw error;
    return data?[data as CalendarResource]:[];
  }
  if(request.requestedMembershipId){
    const {data,error}=await admin.from("appointment_calendar_resources")
      .select("*")
      .eq("organization_id",request.organizationId)
      .eq("assigned_membership_id",request.requestedMembershipId)
      .eq("status","active")
      .order("routing_priority",{ascending:true})
      .order("is_default",{ascending:false});
    if(error) throw error;
    return (data||[]) as CalendarResource[];
  }
  const {data,error}=await admin.from("appointment_calendar_resources")
    .select("*")
    .eq("organization_id",request.organizationId)
    .eq("status","active")
    .order("routing_priority",{ascending:true})
    .order("created_at",{ascending:true});
  if(error) throw error;
  return (data||[]) as CalendarResource[];
}

async function leastBusyOrder(
  organizationId:string,
  resources:CalendarResource[],
  lookaheadDays:number,
){
  if(!resources.length) return resources;
  const start=new Date().toISOString();
  const end=new Date(Date.now()+lookaheadDays*86_400_000).toISOString();
  const {data,error}=await createAdminClient()
    .from("appointments")
    .select("calendar_resource_id")
    .eq("organization_id",organizationId)
    .in("status",["pending_availability","confirmed","rescheduled"])
    .gte("start_at",start)
    .lt("start_at",end);
  if(error) throw error;
  const counts=new Map<string,number>();
  for(const row of data||[]){
    const id=text(row.calendar_resource_id);
    if(id) counts.set(id,(counts.get(id)||0)+1);
  }
  return [...resources].sort((a,b)=>{
    const count=(counts.get(a.id)||0)-(counts.get(b.id)||0);
    if(count!==0) return count;
    const priority=Number(a.routing_priority||100)-Number(b.routing_priority||100);
    if(priority!==0) return priority;
    return a.id.localeCompare(b.id);
  });
}

async function roundRobinOrder(organizationId:string,routingKey:string,resources:CalendarResource[]){
  if(resources.length<=1) return resources;
  const sorted=[...resources].sort((a,b)=>{
    const priority=Number(a.routing_priority||100)-Number(b.routing_priority||100);
    return priority!==0?priority:a.id.localeCompare(b.id);
  });
  const {data,error}=await createAdminClient()
    .from("appointment_routing_state")
    .select("last_resource_id")
    .eq("organization_id",organizationId)
    .eq("routing_key",routingKey)
    .maybeSingle();
  if(error) throw error;
  const last=text(data?.last_resource_id);
  const index=sorted.findIndex((resource)=>resource.id===last);
  if(index<0) return sorted;
  return [...sorted.slice(index+1),...sorted.slice(0,index+1)];
}

function routingKey(request:RoutingRequest){
  return [
    normalizeKey(request.serviceKey)||"*",
    normalizeKey(request.branchKey)||"*",
    normalizeKey(request.departmentKey)||"*",
  ].join("|");
}

export async function selectAppointmentResource(request:RoutingRequest):Promise<RoutingDecision>{
  const settings=await routingSettings(request.organizationId);
  const all=await loadCandidateResources(request);
  if(!all.length){
    return {
      resource:null,startAt:request.startAt,endAt:null,available:false,status:"no_resource",
      strategy:settings.strategy,reason:"No active calendar resource matches the request.",checkedResourceIds:[],
    };
  }

  const explicit=Boolean(request.requestedResourceId||request.requestedMembershipId);
  let candidates=explicit?all:all.filter((resource)=>tagMatch(resource,request));

  if(!candidates.length&&settings.fallbackToDefault&&!explicit){
    const fallback=all.filter((resource)=>resource.is_default);
    candidates=fallback.length?fallback:all;
  }

  if(!candidates.length){
    return {
      resource:null,startAt:request.startAt,endAt:null,available:false,status:"no_resource",
      strategy:settings.strategy,reason:"No eligible calendar resource matches the routing rules.",checkedResourceIds:[],
    };
  }

  if(!explicit){
    candidates=[...candidates].sort((a,b)=>{
      const spec=specificity(b,request)-specificity(a,request);
      if(spec!==0) return spec;
      const priority=Number(a.routing_priority||100)-Number(b.routing_priority||100);
      return priority!==0?priority:Number(b.is_default)-Number(a.is_default);
    });
    if(settings.strategy==="least_busy"){
      candidates=await leastBusyOrder(request.organizationId,candidates,settings.lookaheadDays);
    }else if(settings.strategy==="round_robin"){
      candidates=await roundRobinOrder(request.organizationId,routingKey(request),candidates);
    }
  }

  const checked:string[]=[];
  let lastReason="No eligible resource is available at the requested time.";
  for(const resource of candidates){
    checked.push(resource.id);
    const duration=durationFor(resource,normalizeKey(request.serviceKey)||null,request.requestedDurationMinutes);
    const endAt=request.requestedEndAt?toIso(request.requestedEndAt):addMinutes(toIso(request.startAt),duration);
    const availability=await evaluateResourceAvailability({
      organizationId:request.organizationId,
      resource,startAt:request.startAt,endAt,
      excludeAppointmentId:request.excludeAppointmentId,
    });
    if(!availability.available){
      lastReason=availability.reason||lastReason;
      continue;
    }

    if(settings.strategy==="round_robin"&&!explicit){
      const admin=createAdminClient() as any;
      const {error}=await admin.rpc("advance_appointment_round_robin",{
        p_organization_id:request.organizationId,
        p_routing_key:routingKey(request),
        p_resource_id:resource.id,
      });
      if(error) throw error;
    }

    return {
      resource,startAt:toIso(request.startAt),endAt,available:true,status:"selected",
      strategy:settings.strategy,reason:null,checkedResourceIds:checked,
    };
  }

  return {
    resource:null,startAt:toIso(request.startAt),endAt:null,available:false,status:"unavailable",
    strategy:settings.strategy,reason:lastReason,checkedResourceIds:checked,
  };
}
