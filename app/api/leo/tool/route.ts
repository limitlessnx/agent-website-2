import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  assertLeoToolAllowed,
  leoApprovalFor,
  resolveLeoIdentity,
  type LeoChannel,
} from "@/lib/leo-core";
import { createLeoExecutionEnvelope } from "@/lib/leo-execution-envelope";
import { executeLeoEnvelopeViaN8n } from "@/lib/leo-n8n-executor";
import { auditLeoEvent } from "@/lib/leo-session-store";
import { executeLeoReadTool } from "@/lib/leo-read-tools";
import { boundLeoReadResult } from "@/lib/leo-read-output";
import { dispatchMaiaCampaignAction } from "@/lib/maia-action-gateway";
import type { ProgressiveLead } from "@/lib/lead-profile-service";

type LeoArguments = Record<string, unknown>;

function channel(value: unknown): LeoChannel {
  return value === "voice" ? "voice" : value === "api" ? "api" : "chat";
}

function object(value: unknown): LeoArguments {
  return value && typeof value === "object" && !Array.isArray(value) ? value as LeoArguments : {};
}

function isLimitlessRealtyTarget(args: LeoArguments) {
  const value = String(args.organizationName || args.organization_name || args.organizationSlug || args.organization_slug || "").trim().toLowerCase();
  return value === "limitless realty" || value === "limitless-realty" || value === "limitless_realty";
}

async function executeApprovedLimitlessFollowup(identity: Awaited<ReturnType<typeof resolveLeoIdentity>>, args: LeoArguments) {
  if (!identity || identity.scope !== "super_admin") throw new Error("Limitless Realty follow-up sending requires Super Admin scope.");
  if (!isLimitlessRealtyTarget(args)) throw new Error("A resolved target organization is required before sending a client follow-up.");
  const message = String(args.message || args.text || "").trim();
  if (!message) throw new Error("The exact follow-up message is required.");

  const leadQuery = String(args.leadQuery || args.query || args.leadName || args.name || args.phone || "").trim();
  if (!leadQuery) throw new Error("The exact client/lead must be identified before sending a follow-up.");

  const lookup = await executeLeoReadTool({
    identity,
    toolKey: "leo.crm.leads.read",
    arguments: {
      organizationName: "Limitless Realty",
      query: leadQuery,
      limit: 10,
    },
  });
  const leads = Array.isArray(lookup.leads) ? lookup.leads : [];
  if (leads.length !== 1) {
    throw new Error(leads.length === 0
      ? `No unique Limitless Realty lead matched "${leadQuery}".`
      : `More than one Limitless Realty lead matched "${leadQuery}". Leo must not guess the recipient.`);
  }

  const lead = leads[0] as Record<string, unknown>;
  const phone = String(lead.phone || "").trim();
  const name = String(lead.name || lead.display_name || lead.title || "client").trim();
  if (!phone) throw new Error(`The Limitless Realty lead "${name}" has no contactable phone number.`);

  const recipient: ProgressiveLead = {
    id: String(lead.id || phone),
    name,
    phone,
    status: String(lead.status || "new"),
    campaign_eligible: true,
  };

  const result = await dispatchMaiaCampaignAction({
    commandId: String(args.commandId || randomUUID()),
    campaignType: "limitless_realty_reminder",
    topic: String(args.topic || "Limitless Realty client follow-up"),
    message,
    recipients: [recipient],
    mediaUrl: String(args.mediaUrl || "").trim() || undefined,
    createdBy: identity.email || "fluxknight_super_admin",
  });

  return {
    ok: true,
    recipient: { id: lead.id || null, name, phone },
    message,
    delivery: {
      status: result.status,
      executionId: result.executionId,
      attempted: result.attempted,
      accepted: result.accepted,
      failed: result.failed,
      pendingDelivery: result.pendingDelivery,
      skipped: result.skipped,
      freeFormSent: result.freeFormSent,
      templateSent: result.templateSent,
      acceptedRecipients: result.acceptedRecipients,
      failedRecipients: result.failedRecipients,
      providerMessage: result.message,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const identity = await resolveLeoIdentity({ channel: channel(body.channel), allowPublic: true });
    if (!identity) return NextResponse.json({ error: "Leo identity could not be resolved." }, { status: 401 });

    const toolKey = String(body.toolKey || body.tool_key || "").trim();
    if (!toolKey) return NextResponse.json({ error: "toolKey is required." }, { status: 400 });
    const tool = assertLeoToolAllowed(identity, toolKey);
    const approval = leoApprovalFor(identity, tool.key);
    const confirmed = body.confirmed === true;
    const args = object(body.arguments);

    if (tool.readOnly) {
      const result = await executeLeoReadTool({ identity, toolKey: tool.key, arguments: args });
      await auditLeoEvent({ identity, eventType: "read_tool_executed", toolKey: tool.key, details: { channel: identity.channel } });
      return NextResponse.json({ ok: true, result: boundLeoReadResult(result), approval, channel: identity.channel, scope: identity.scope });
    }

    if (approval === "admin" && identity.scope !== "super_admin") {
      await auditLeoEvent({ identity, eventType: "admin_approval_denied", toolKey: tool.key, details: { channel: identity.channel } });
      return NextResponse.json({ error: "This Leo action requires Fluxknight Super Admin approval." }, { status: 403 });
    }

    if ((approval === "confirm" || approval === "admin") && !confirmed) {
      return NextResponse.json({
        ok: true,
        status: "confirmation_required",
        toolKey: tool.key,
        title: tool.title,
        message: `Confirm ${tool.title.toLowerCase()} before Leo executes it.`,
      });
    }

    if (tool.key === "leo.crm.followup.send" && identity.scope === "super_admin" && isLimitlessRealtyTarget(args)) {
      await auditLeoEvent({ identity, eventType: "tool_execution_dispatched", toolKey: tool.key, details: { channel: identity.channel, approval, execution_mode: "maia_action_gateway" } });
      const result = await executeApprovedLimitlessFollowup(identity, args);
      await auditLeoEvent({ identity, eventType: "tool_execution_completed", toolKey: tool.key, details: { channel: identity.channel, approval, recipient_id: result.recipient.id, delivery_status: result.delivery.status, execution_id: result.delivery.executionId } });
      return NextResponse.json({ ...result, toolKey: tool.key, approval, channel: identity.channel, scope: identity.scope });
    }

    const requestId = String(body.requestId || body.request_id || randomUUID()).trim();
    const sessionId = String(body.sessionId || body.session_id || "").trim() || null;
    const envelope = createLeoExecutionEnvelope({
      requestId,
      sessionId,
      identity,
      toolKey: tool.key,
      arguments: args,
      approvalGranted: approval === "none" || confirmed,
    });

    await auditLeoEvent({
      identity,
      eventType: "tool_execution_dispatched",
      toolKey: tool.key,
      details: { request_id: requestId, channel: identity.channel, approval },
    });

    const result = await executeLeoEnvelopeViaN8n(envelope);
    return NextResponse.json({
      ...result,
      approval,
      channel: identity.channel,
      scope: identity.scope,
    }, { status: result.ok ? 200 : 502 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Leo could not execute this action.";
    return NextResponse.json({ error: message }, { status: /not permitted|Cross-tenant|Unauthorized|Super Admin/i.test(message) ? 403 : 500 });
  }
}
