import { NextResponse } from "next/server";
import { secureEqual } from "@/lib/runtime/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { processDueRealEstateInspectionJobs } from "@/lib/real-estate-inspection-worker";
export const maxDuration=300;

async function authorized(request:Request){
 const expected=process.env.CRON_SECRET?.trim()||"";
 const bearer=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
 if(expected&&bearer&&secureEqual(expected,bearer))return true;
 const token=(request.headers.get("x-maia-scheduler-token")||"").trim();if(!token)return false;
 const {data,error}=await createAdminClient().rpc("verify_maia_scheduler_secret",{candidate:token});return !error&&data===true;
}
type UnknownRecord = Record<string, unknown>;
function record(value: unknown): UnknownRecord {
 return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}
function compactResult(organizationId:string,result:unknown){
 const resultRecord=record(result);
 const rows=Array.isArray(resultRecord.results)?resultRecord.results.map(record):[];
 const counts={sent:rows.filter((row)=>row.status==="sent").length,failed:rows.filter((row)=>row.status==="failed").length,cancelled:rows.filter((row)=>row.status==="cancelled").length,unknown:rows.filter((row)=>row.status==="unknown").length};
 return {organizationId,processed:Number(resultRecord.processed)||rows.length,counts};
}
export async function GET(request:Request){
 let authorizedRequest=false;
 try{authorizedRequest=await authorized(request);}catch{return NextResponse.json({ok:false,error:"Scheduler authorization could not be verified."},{status:503});}
 if(!authorizedRequest)return NextResponse.json({ok:false,error:"Unauthorized scheduler request."},{status:401});
 const admin=createAdminClient();
 const {data,error}=await admin.rpc("list_due_real_estate_inspection_organizations",{p_limit:25});
 if(error)return NextResponse.json({ok:false,error:"The tenant opt-in schedule registry is unavailable; apply the reviewed inspection migration."},{status:503});
 const ids=[...new Set((Array.isArray(data)?data:[]).map((row)=>String(record(row).organization_id||"")).filter(Boolean))];
 const results:Array<Record<string,unknown>>=[];let next=0;
 async function runner(){while(next<ids.length){const organizationId=ids[next++];try{const result=await processDueRealEstateInspectionJobs({organizationId,limit:5});results.push(compactResult(organizationId,result));}catch{results.push({organizationId,processed:0,error:"Tenant inspection reminder processing failed; inspect the tenant's operational record."});}}}
 await Promise.all(Array.from({length:Math.min(3,ids.length)},()=>runner()));
 const ok=results.every(row=>!row.error);
 return NextResponse.json({ok,tenants:results.length,results},{status:ok?200:207});
}
