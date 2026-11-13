import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { requireAdminSystemScope } from "@/lib/admin-organization-scope";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function scope() {
  if (!(await getAdminSession())) return null;
  try {
    const result = await requireAdminSystemScope("gencouv");
    return result.status !== "unavailable" ? result.organizationId : null;
  } catch { return null; }
}
export async function GET(request: NextRequest) {
  const organizationId = await scope();
  if (!organizationId) return NextResponse.json({error:"Gencouv admin workspace required."},{status:403,headers});
  const categoryId = request.nextUrl.searchParams.get("category_id") || "";
  if (categoryId && !uuid.test(categoryId)) return NextResponse.json({error:"Invalid category."},{status:400,headers});
  const db = createAdminClient();
  let ids: string[] | null = null;
  if (categoryId) {
    const {data:category,error:categoryError} = await db.from("crm_lead_categories").select("id")
      .eq("organization_id",organizationId).eq("id",categoryId).maybeSingle();
    if (categoryError || !category) return NextResponse.json({error:"Category not found."},{status:404,headers});
    const {data:assigned,error} = await db.from("crm_customer_category_assignments")
      .select("customer_id").eq("organization_id",organizationId).eq("category_id",categoryId).limit(1000);
    if (error) return NextResponse.json({error:"Could not load category audience."},{status:503,headers});
    ids = (assigned || []).map(row=>row.customer_id);
  }
  if (ids && !ids.length) return NextResponse.json({total:0,eligible:0,unverified:0,suppressed:0,contacts:[],truncated:false},{headers});
  let query = db.from("crm_customers").select("id,full_name,email,metadata,status")
    .eq("organization_id",organizationId).not("email","is",null).limit(501);
  if (ids) query = query.in("id",ids);
  const {data,error} = await query;
  if (error) return NextResponse.json({error:"Unable to load audience."},{status:503,headers});
  const rows = data || [];
  const addresses = rows.map(row=>String(row.email||"").trim().toLowerCase()).filter(Boolean);
  // Keep PostgREST query strings bounded when reviewing a full 500-contact audience.
  const suppressed = new Set<string>();
  for (let i = 0; i < addresses.length; i += 75) {
    const batch = addresses.slice(i, i + 75);
    const {data:stopped,error:suppressionError} = await db.from("gencouv_suppression_list")
      .select("normalized_email").eq("organization_id",organizationId).in("normalized_email",batch);
    if (suppressionError) return NextResponse.json({error:"Suppression check unavailable. Audience withheld."},{status:503,headers});
    for (const row of stopped || []) suppressed.add(String(row.normalized_email).toLowerCase());
  }
  const stats={eligible:0,unverified:0,suppressed:0};
  const contacts = rows.map(row=>{
    const email=String(row.email||"").trim().toLowerCase();
    const consent = row.metadata && typeof row.metadata==="object" && !Array.isArray(row.metadata)
      ? String((row.metadata as Record<string,unknown>).marketing_consent||"unknown").toLowerCase() : "unknown";
    const blocked = suppressed.has(email)||row.status==="blocked"||row.status==="archived";
    const eligible = !blocked && consent==="granted";
    if (blocked) stats.suppressed++;
    else if (eligible) stats.eligible++;
    else stats.unverified++;
    return {id:row.id,full_name:row.full_name,email,eligible,reason:blocked?"suppressed":eligible?"consent_granted":"consent_unverified"};
  });
  return NextResponse.json({total:contacts.length,...stats,truncated:rows.length>500,contacts:contacts.slice(0,500),note:"Preview only. No audience is enrolled or emailed."},{headers});
}
