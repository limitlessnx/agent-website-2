import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const credentials = body.credentials && typeof body.credentials === "object" ? body.credentials : {};
    const configuration = body.configuration && typeof body.configuration === "object" ? body.configuration : {};

    const cleanedCredentials = Object.fromEntries(
      Object.entries(credentials)
        .map(([key, value]) => [key.trim(), String(value ?? "").trim()])
        .filter(([key, value]) => key && value),
    );

    if (!Object.keys(cleanedCredentials).length) {
      return NextResponse.json({ error: "Enter at least one credential." }, { status: 400 });
    }

    const result = await supabaseServerRequest<Record<string, unknown>>(
      "rpc/upsert_integration_credentials",
      {
        method: "POST",
        body: JSON.stringify({
          p_integration_id: id,
          p_credentials: cleanedCredentials,
          p_configuration: configuration,
          p_actor_email: session.email,
        }),
      },
    );

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save integration credentials." },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const { id } = await context.params;
    const result = await supabaseServerRequest<Record<string, unknown>>(
      "rpc/disconnect_organization_integration",
      {
        method: "POST",
        body: JSON.stringify({ p_integration_id: id, p_actor_email: session.email }),
      },
    );
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to disconnect integration." },
      { status: 400 },
    );
  }
}