import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  ADMIN_ORGANIZATION_COOKIE,
  serializeAdminOrganizationContext,
} from "@/lib/admin-organization-context";
import { authorizeWorkspaceSelection, WorkspaceSelectionError } from "@/lib/admin-workspace-selection";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin session required." }, { status: 401 });

  const origin = request.headers.get("origin");
  let sameOrigin = request.headers.get("sec-fetch-site") !== "cross-site";
  if (origin) {
    try {
      const source = new URL(origin);
      const target = new URL(request.url);
      // Next may canonicalize request.url to localhost behind a reverse proxy.
      sameOrigin = sameOrigin && source.protocol === target.protocol && (source.host === target.host || source.host === request.headers.get("host"));
    } catch { sameOrigin = false; }
  }
  if (!sameOrigin) return NextResponse.json({ error: "Same-origin request required." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid selection." }, { status: 400 });
  let selection;
  try { selection = await authorizeWorkspaceSelection(session, body); }
  catch (error) { return NextResponse.json({ error: error instanceof WorkspaceSelectionError ? error.message : "Workspace is temporarily unavailable." }, { status: error instanceof WorkspaceSelectionError ? error.status : 503 }); }
  const { kind, id } = selection;

  const response = NextResponse.json({ ok: true, kind, id });
  // Retire the legacy path-specific cookie so it cannot shadow the root selection.
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
