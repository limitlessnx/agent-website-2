import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { saveAutomationTemplate, saveAutomationTemplateVersion } from "@/lib/automation-provisioning";

export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const body = await request.json();
    const template = await saveAutomationTemplate({
      name: String(body.name || ""),
      slug: String(body.slug || ""),
      description: body.description ? String(body.description) : undefined,
      category: body.category ? String(body.category) : undefined,
      channels: Array.isArray(body.channels) ? body.channels.map(String) : String(body.channels || "").split(",").map((item) => item.trim()).filter(Boolean),
      required_plan: body.required_plan ? String(body.required_plan) : undefined,
      setup_price: Number(body.setup_price || 0),
      recurring_price: Number(body.recurring_price || 0),
      currency: body.currency ? String(body.currency) : "NGN",
      status: body.status === "available" ? "available" : "draft",
    });

    if (body.source_n8n_workflow_id) {
      await saveAutomationTemplateVersion({
        automation_template_id: template.id,
        version: Number(body.version || 1),
        source_n8n_workflow_id: String(body.source_n8n_workflow_id),
        source_n8n_workflow_name: body.source_n8n_workflow_name ? String(body.source_n8n_workflow_name) : undefined,
        validation_notes: body.validation_notes ? String(body.validation_notes) : undefined,
        status: body.version_status === "approved" ? "approved" : "draft",
      });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Automation template save failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save automation template." }, { status: 500 });
  }
}
