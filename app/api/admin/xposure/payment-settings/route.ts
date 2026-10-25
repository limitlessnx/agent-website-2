import { NextResponse } from "next/server";
import { authorizeXposureTenantAccess } from "@/lib/xposure-tenant-authorization";

// Xposure payment instructions are maintained in Maia's knowledge base, not in application tables.
// The dashboard must not persist bank details or imply that Fluxknight verifies transfers.
export async function GET() {
  const access = await authorizeXposureTenantAccess("systems.view");
  if (!access.ok) return access.response;
  return NextResponse.json({ configured: false, enabled: false, verified: false, account: null, managedBy: "maia_knowledge_base" });
}

export async function PUT() {
  const access = await authorizeXposureTenantAccess("systems.manage");
  if (!access.ok) return access.response;
  return NextResponse.json({ error: "Xposure payment instructions are managed in Maia's knowledge base. Transfers must be verified manually by the Xposure handover agent." }, { status: 410 });
}
