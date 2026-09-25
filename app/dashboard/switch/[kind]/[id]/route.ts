import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  ADMIN_ORGANIZATION_COOKIE,
  serializeAdminOrganizationContext,
  SYSTEM_ORGANIZATIONS,
} from "@/lib/admin-organization-context";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.redirect(new URL("/login?next=/dashboard", request.url));

  const { kind: rawKind, id } = await params;
  const kind = rawKind === "tenant" ? "tenant" : rawKind === "system" ? "system" : null;
  if (!kind || !id) return NextResponse.redirect(new URL("/dashboard", request.url));

  if (kind === "system" && !SYSTEM_ORGANIZATIONS.some((item) => item.id === id)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (kind === "tenant") {
    const admin = createAdminClient();
    const { data } = await admin.from("organizations").select("id").eq("id", id).maybeSingle();
    if (!data) return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set(ADMIN_ORGANIZATION_COOKIE, serializeAdminOrganizationContext({ kind, id }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/dashboard",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
