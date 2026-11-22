import { getAdminSession } from "@/lib/admin-auth";
import { requireAdminSystemScope } from "@/lib/admin-organization-scope";
import { createAdminClient } from "@/lib/supabase/admin";

export const GENCOUV_ORGANIZATION_ID = "05737e03-f8f0-4202-8e9b-0a8982a1091c";
export const GENCOUV_CAMPAIGN_KEY = "gencouv_long_form_copy_trading";
export const GENCOUV_SENDERS = new Set(["info@gencouv.com", "support@gencouv.com", "onboarding@gencouv.com"]);
export const GENCOUV_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const GENCOUV_EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
export const gencouvPrivateHeaders = { "Cache-Control": "private, no-store" };

export class GencouvRequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function requireGencouvAdmin(request?: Request) {
  const session = await getAdminSession();
  if (!session) throw new GencouvRequestError("Administrator sign-in required.", 401);
  const scope = await requireAdminSystemScope("gencouv").catch(() => null);
  if (!scope || scope.organizationId !== GENCOUV_ORGANIZATION_ID || scope.status !== "active") {
    throw new GencouvRequestError("Switch to the active Gencouv workspace.", 403);
  }
  if (request && !["GET", "HEAD"].includes(request.method)) {
    const url=new URL(request.url);
    // Next's internal URL can use a loopback hostname. Validate the browser's
    // origin against the actual Host header, retaining the request protocol.
    const expectedOrigin=`${url.protocol}//${request.headers.get("host")||url.host}`;
    if(request.headers.get("origin")!==expectedOrigin)throw new GencouvRequestError("Invalid request origin.",403);
  }
  return { db: createAdminClient(), organizationId: scope.organizationId, session };
}

export function gencouvError(error: unknown) {
  return { message: error instanceof GencouvRequestError ? error.message : "This action is temporarily unavailable. Retry after checking its saved status.", status: error instanceof GencouvRequestError ? error.status : 503 };
}
