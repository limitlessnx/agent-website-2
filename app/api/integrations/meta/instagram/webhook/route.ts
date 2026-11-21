import { NextResponse } from "next/server";
import { verifyMetaWebhook } from "@/lib/meta-webhook";
import {
  getFluxknightOrganization,
  getMetaCredentials,
} from "@/lib/meta-integration";

export const dynamic = "force-dynamic";

function unauthorized() {
  return new NextResponse("Forbidden", { status: 403 });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !verifyToken || !challenge) {
    return unauthorized();
  }

  const organization = await getFluxknightOrganization();
  const credentials = await getMetaCredentials(organization.id);
  const expected = String(
    credentials?.instagram_webhook_verify_token || "",
  ).trim();

  if (!expected || verifyToken !== expected) {
    return unauthorized();
  }

  return new NextResponse(challenge, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const organization = await getFluxknightOrganization();
  const credentials = await getMetaCredentials(organization.id);
  const signature = request.headers.get("x-hub-signature-256");
  // Meta's parent app and Instagram Login product can have distinct secrets.
  if (![credentials?.app_secret, credentials?.instagram_app_secret].some(secret =>
    typeof secret === "string" && verifyMetaWebhook(rawBody, signature, secret))) return unauthorized();
  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody); } catch { return new NextResponse("Invalid JSON", { status: 400 }); }

  console.info("Instagram webhook received", {
    hasBody: Boolean(body),
    object:
      body && typeof body === "object" && "object" in body
        ? String((body as Record<string, unknown>).object || "")
        : null,
  });

  return NextResponse.json({ received: true });
}
