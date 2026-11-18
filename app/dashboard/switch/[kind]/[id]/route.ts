import { isSpeculativeRequest } from "@/lib/speculative-request";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  ADMIN_ORGANIZATION_COOKIE,
  serializeAdminOrganizationContext,
} from "@/lib/admin-organization-context";
import { authorizeWorkspaceSelection } from "@/lib/admin-workspace-selection";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  if (isSpeculativeRequest(request)) return new NextResponse(null, {status:204,headers:{"Cache-Control":"no-store"}});
  const session = await getAdminSession();
  if (!session) return NextResponse.redirect(new URL("/login?next=/dashboard", request.url));

  const { kind: rawKind, id } = await params;
  const kind = rawKind === "tenant" ? "tenant" : rawKind === "system" ? "system" : null;
  if (!kind || !id) return NextResponse.redirect(new URL("/dashboard", request.url));

  if (request.headers.get("sec-fetch-site") === "cross-site") return new NextResponse("Same-origin navigation required.", { status: 403 });
  try { await authorizeWorkspaceSelection(session, { kind, id }); }
  catch { return NextResponse.redirect(new URL("/dashboard/organizations?selection=unavailable", request.url)); }

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set(ADMIN_ORGANIZATION_COOKIE, serializeAdminOrganizationContext({ kind, id }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  response.headers.append("Set-Cookie", `${ADMIN_ORGANIZATION_COOKIE}=; Path=/dashboard; Max-Age=0; HttpOnly; SameSite=Lax`);
  return response;
}
