import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "create_model") {
      const provider = String(body.provider || "").trim().toLowerCase();
      const modelKey = String(body.modelKey || "").trim();
      const displayName = String(body.displayName || "").trim();

      if (!provider || !modelKey || !displayName) {
        return NextResponse.json({ error: "Provider, model key, and display name are required." }, { status: 400 });
      }

      const result = await supabaseServerRequest(
        "ai_model_catalog",
        {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ provider, model_key: modelKey, display_name: displayName, status: "active" }),
        },
      );

      return NextResponse.json({ ok: true, result });
    }

    if (action === "assign_model") {
      const organizationId = String(body.organizationId || "").trim();
      const modelId = String(body.modelId || "").trim();

      if (!organizationId || !modelId) {
        return NextResponse.json({ error: "Organization and model are required." }, { status: 400 });
      }

      const result = await supabaseServerRequest(
        "organization_ai_model_assignments?on_conflict=organization_id,model_id",
        {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=representation" },
          body: JSON.stringify({ organization_id: organizationId, model_id: modelId, assigned_by: null }),
        },
      );

      return NextResponse.json({ ok: true, result });
    }

    if (action === "assign_models") {
      const organizationId = String(body.organizationId || "").trim();
      const modelIds = Array.isArray(body.modelIds)
        ? [...new Set(body.modelIds.map((value: unknown) => String(value || "").trim()).filter(Boolean))]
        : [];

      if (!organizationId) {
        return NextResponse.json({ error: "Organization is required." }, { status: 400 });
      }
      if (!modelIds.length) {
        return NextResponse.json({ error: "Select at least one AI model." }, { status: 400 });
      }

      await supabaseServerRequest(
        `organization_ai_model_assignments?organization_id=eq.${encodeURIComponent(organizationId)}`,
        { method: "DELETE" },
      );

      const rows = modelIds.map((modelId) => ({
        organization_id: organizationId,
        model_id: modelId,
        assigned_by: null,
      }));

      const result = await supabaseServerRequest(
        "organization_ai_model_assignments?on_conflict=organization_id,model_id",
        {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=representation" },
          body: JSON.stringify(rows),
        },
      );

      return NextResponse.json({ ok: true, result, modelIds });
    }

    if (action === "set_status") {
      const modelId = String(body.modelId || "").trim();
      const status = String(body.status || "").trim();

      if (!modelId || !["active", "disabled"].includes(status)) {
        return NextResponse.json({ error: "A valid model and status are required." }, { status: 400 });
      }

      const result = await supabaseServerRequest(
        `ai_model_catalog?id=eq.${encodeURIComponent(modelId)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ status }),
        },
      );

      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update AI model controls." },
      { status: 400 },
    );
  }
}
