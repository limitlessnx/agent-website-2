import { isSpeculativeRequest } from "@/lib/speculative-request";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_ORGANIZATION_COOKIE, serializeAdminOrganizationContext } from "@/lib/admin-organization-context";
import { createAdminTenantPreviewToken } from "@/lib/client-auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isSpeculativeRequest(request)) return new NextResponse(null, {status:204});
  const session = await getAdminSession();
  if (!session) return NextResponse.redirect(new URL("/login?next=/dashboard", request.url));

  const { id } = await params;
  const organizationId = String(id || "").trim();
  if (!organizationId) return NextResponse.redirect(new URL("/dashboard/clients", request.url));

  const admin = createAdminClient();
  const { data: organization } = await admin.from("organizations").select("id").eq("id", organizationId).maybeSingle();
  if (!organization) return NextResponse.redirect(new URL("/dashboard/clients", request.url));

  const response = NextResponse.redirect(new URL("/portal", request.url));
  response.cookies.set(ADMIN_ORGANIZATION_COOKIE, serializeAdminOrganizationContext({ kind: "tenant", id: organizationId }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  response.cookies.set("fluxknight_admin_tenant_preview_v2", createAdminTenantPreviewToken(organizationId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });
  // ResponseCookies is keyed by name: append separate headers to expire every legacy path.
  for (const path of ["/", "/portal", "/portal/"]) response.headers.append("Set-Cookie", `fluxknight_admin_tenant_preview=; Path=${path}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  return response;
}
