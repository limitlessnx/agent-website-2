import { supabaseServerRequest } from "@/lib/supabase-server-rest";
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
/** Native snapshot reuses CRM, qualified leads and persisted campaign state; no external automation dependency. */
export async function loadGencouvNativeDashboard<T>(): Promise<GencouvFeedResult<T>> {
  try {
    const data: unknown = await supabaseServerRequest("rpc/gencouv_dashboard_snapshot", {
      method: "POST", body: JSON.stringify({ p_organization_id: "05737e03-f8f0-4202-8e9b-0a8982a1091c" }),
    });
    if (!isGencouvDashboardFeed(data)) throw new Error("Invalid snapshot");
    return { data: data as T, error: null };
  } catch {
    return { data: null, error: "The database overview is temporarily unavailable. Contact imports and manual email tools remain available." };
  }
}
