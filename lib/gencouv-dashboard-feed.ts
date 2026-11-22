export type GencouvFeedResult<T>={data:T|null;error:string|null};
const record=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
export function isGencouvDashboardFeed(value:unknown):boolean{
  if(!record(value)||value.success!==true)return false;
  if(value.totals!==undefined&&(!record(value.totals)||!Object.values(value.totals).every(item=>typeof item==='number'&&Number.isFinite(item))))return false;
  if(value.recent_leads!==undefined&&(!Array.isArray(value.recent_leads)||!value.recent_leads.every(record)))return false;
  if(value.lead_boards!==undefined&&(!record(value.lead_boards)||!Object.values(value.lead_boards).every(items=>Array.isArray(items)&&items.every(record))))return false;
  if(value.breakdowns!==undefined&&(!record(value.breakdowns)||!Object.values(value.breakdowns).every(items=>record(items)&&Object.values(items).every(item=>typeof item==='number'&&Number.isFinite(item)))))return false;
  if(value.email_controls!==undefined&&!record(value.email_controls))return false;
  return true;
}
/** Feed failures remain independent from the CRM and manual email APIs. */
export async function loadGencouvDashboardFeed<T>(url:string,secret:string|undefined):Promise<GencouvFeedResult<T>>{
  if(!secret)return{data:null,error:'The external dashboard feed is not configured. CRM and manual email tools remain available.'};
  try{
    const response=await fetch(url,{headers:{'x-gencouv-dashboard-secret':secret},cache:'no-store',signal:AbortSignal.timeout(5000)});
    if(!response.ok)return{data:null,error:'The external dashboard feed rejected the request. CRM and manual email tools remain available.'};
    const data:unknown=await response.json();
    if(!isGencouvDashboardFeed(data))return{data:null,error:'The external dashboard feed returned an invalid response. CRM and manual email tools remain available.'};
    return{data:data as T,error:null};
  }catch{return{data:null,error:'The external dashboard feed is unavailable or timed out. CRM and manual email tools remain available.'};}
}
