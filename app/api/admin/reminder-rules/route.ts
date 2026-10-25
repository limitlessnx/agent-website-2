import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { authorizeXposureTenantAccess } from "@/lib/xposure-tenant-authorization";
import { createAdminClient } from "@/lib/supabase/admin";

const TRIGGERS = new Set(["date", "recurring", "event"]);
const CHANNELS = new Set(["internal", "whatsapp", "email"]);
const MODES = new Set(["template", "ai"]);
const STATUSES = new Set(["draft", "active", "paused", "archived"]);
const FREQUENCIES = new Set(["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly", "custom"]);

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to process reminder rule.";
}

export async function GET() {
  const access = await authorizeXposureTenantAccess("workflows.read");
  if (!access.ok) return access.response;
  try {
    const scope = { organizationId: access.organizationId, name: "Xposure Studios", slug: "xposure" };
    const admin = createAdminClient();
    const { data, error } = await admin.from("tenant_reminder_rules")
      .select("id,organization_id,name,description,trigger_type,event_key,anchor_field,schedule_config,audience_config,channel,message_mode,message_template,timezone,status,starts_at,ends_at,created_at,updated_at")
      .eq("organization_id", scope.organizationId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ rules: data ?? [], organization: { id: scope.organizationId, name: scope.name, slug: scope.slug } });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const access = await authorizeXposureTenantAccess("workflows.manage");
  if (!access.ok) return access.response;
  const session = await getAdminSession();
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const triggerType = String(body.trigger_type ?? "");
    const channel = String(body.channel ?? "internal");
    const messageMode = String(body.message_mode ?? "template");
    const status = String(body.status ?? "draft");
    const timezone = String(body.timezone ?? "Africa/Lagos");
    const schedule = body.schedule_config && typeof body.schedule_config === "object" && !Array.isArray(body.schedule_config) ? body.schedule_config : {};
    const audience = body.audience_config && typeof body.audience_config === "object" && !Array.isArray(body.audience_config) ? body.audience_config : {};
    if (name.length < 2 || name.length > 140) return NextResponse.json({ error: "Name must be between 2 and 140 characters." }, { status: 400 });
    if (!TRIGGERS.has(triggerType)) return NextResponse.json({ error: "Choose a valid trigger type." }, { status: 400 });
    if (!CHANNELS.has(channel) || !MODES.has(messageMode) || !STATUSES.has(status)) return NextResponse.json({ error: "Invalid channel, message mode, or status." }, { status: 400 });
    if (triggerType === "recurring" && !FREQUENCIES.has(String(schedule.frequency ?? ""))) return NextResponse.json({ error: "Choose a supported recurrence frequency." }, { status: 400 });
    if (triggerType === "date" && !body.anchor_field && !schedule.date) return NextResponse.json({ error: "A date field or specific date is required." }, { status: 400 });
    if (triggerType === "event" && !String(body.event_key ?? "").trim()) return NextResponse.json({ error: "An event key is required." }, { status: 400 });
    if (channel !== "internal" && !String(body.message_template ?? "").trim()) return NextResponse.json({ error: "A message template is required for external delivery." }, { status: 400 });

    const scope = { organizationId: access.organizationId };
    const admin = createAdminClient();
    const { data, error } = await admin.from("tenant_reminder_rules").insert({
      organization_id: scope.organizationId,
      name,
      description: String(body.description ?? "").slice(0, 2000),
      trigger_type: triggerType,
      event_key: triggerType === "event" ? String(body.event_key).trim() : null,
      anchor_field: triggerType === "date" && body.anchor_field ? String(body.anchor_field).slice(0, 100) : null,
      schedule_config: schedule,
      audience_config: audience,
      channel,
      message_mode: messageMode,
      message_template: String(body.message_template ?? "").slice(0, 10000),
      timezone,
      status,
      starts_at: body.starts_at || null,
      ends_at: body.ends_at || null,
      created_by: session?.email ?? access.actorUserId,
    }).select("id,organization_id,name,description,trigger_type,event_key,anchor_field,schedule_config,audience_config,channel,message_mode,message_template,timezone,status,starts_at,ends_at,created_at,updated_at").single();
    if (error) throw error;
    return NextResponse.json({ rule: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const access = await authorizeXposureTenantAccess("workflows.manage");
  if (!access.ok) return access.response;
  try {
    const body = await request.json();
    const id = String(body.id ?? "");
    const status = String(body.status ?? "");
    if (!id || !STATUSES.has(status)) return NextResponse.json({ error: "Rule ID and valid status are required." }, { status: 400 });
    const scope = { organizationId: access.organizationId };
    const admin = createAdminClient();
    const { data, error } = await admin.from("tenant_reminder_rules").update({ status, updated_at: new Date().toISOString() })
      .eq("id", id).eq("organization_id", scope.organizationId)
      .select("id,status").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Reminder rule not found in this organization." }, { status: 404 });
    return NextResponse.json({ rule: data });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
