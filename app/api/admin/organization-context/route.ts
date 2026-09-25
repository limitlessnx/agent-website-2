import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  ADMIN_ORGANIZATION_COOKIE,
  serializeAdminOrganizationContext,
  SYSTEM_ORGANIZATIONS,
} from "@/lib/admin-organization-context";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin session required." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const kind = body.kind === "tenant" ? "tenant" : "system";
  const id = String(body.id || "").trim();

  if (!id) return NextResponse.json({ error: "Organization id is required." }, { status: 400 });
  if (kind === "system" && !SYSTEM_ORGANIZATIONS.some((item) => item.id === id)) {
    return NextResponse.json({ error: "Unknown system organization." }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true, kind, id });
  response.cookies.set(ADMIN_ORGANIZATION_COOKIE, serializeAdminOrganizationContext({ kind, id }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/dashboard",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
