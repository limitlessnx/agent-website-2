import { NextRequest, NextResponse } from "next/server";
import { secureEqual } from "@/lib/runtime/auth";
import { verifyLeoExecutionEnvelope } from "@/lib/leo-execution-envelope";
import { executeAuthorizedLeoTool } from "@/lib/leo-tool-runtime";
import { leoApprovalFor, assertLeoToolAllowed } from "@/lib/leo-core";
import { auditLeoEvent } from "@/lib/leo-session-store";
import { consumeLeoActionApproval, isRealEstateApprovalTool, LIMITLESS_REALTY_ORGANIZATION_ID } from "@/lib/leo-action-approval";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveActiveRealEstateOrganization } from "@/lib/real-estate-organization";

function authorizeBridge(request: NextRequest) {
  const expected = (process.env.LEO_N8N_SHARED_SECRET || process.env.RUNTIME_GATEWAY_SECRET || "").trim();
  const supplied = request.headers.get("x-fluxknight-leo-secret") || "";
  return Boolean(expected && secureEqual(expected, supplied));
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) { return typeof value === "string" ? value.trim() : String(value || "").trim(); }
function workspaceClaim(args: Record<string, unknown>) {
  const value = text(args.workspace || args.organization || args.organization_name).toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return ["limitless_realty", "limitless", "limitlessrealty"].includes(value);
}
function organizationId(args: Record<string, unknown>) { return text(args.organization_id || args.organizationId); }
function stripApproval(args: Record<string, unknown>) {
  const clean = { ...args };
  delete clean._real_estate_approval;
  return clean;
}
async function resolveExecutorRealEstateTarget(args:Record<string,unknown>,identity:Awaited<ReturnType<typeof verifyLeoExecutionEnvelope>>["identity"],forceLimitless:boolean){
 const requested=organizationId(args);
 if(identity.scope==="tenant"&&requested&&requested!==identity.organizationId)throw new Error("Signed action organization does not match the authenticated tenant.");
 if(forceLimitless&&requested&&requested!==LIMITLESS_REALTY_ORGANIZATION_ID)throw new Error("The signed action does not target the verified Limitless Realty organization.");
 let id=forceLimitless?LIMITLESS_REALTY_ORGANIZATION_ID:identity.scope==="tenant"?String(identity.organizationId||""):requested;
 if(!id&&workspaceClaim(args))id=LIMITLESS_REALTY_ORGANIZATION_ID;
 if(!id)return null;
 const organization=await resolveActiveRealEstateOrganization(createAdminClient(),id);
 if(!organization){if(forceLimitless||workspaceClaim(args))throw new Error("The active real-estate organization could not be verified.");return null;}
 if(forceLimitless&&organization.id!==LIMITLESS_REALTY_ORGANIZATION_ID)throw new Error("Limitless-only actions cannot target another organization.");
 args.organization_id=organization.id;args.workspace=organization.slug.replace(/-/g,"_");return organization;
}
export async function POST(request: NextRequest) {
  if (!authorizeBridge(request)) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

  const startedAt = Date.now();
  let auditIdentity: Awaited<ReturnType<typeof verifyLeoExecutionEnvelope>>["identity"] | null = null;
  let auditToolKey = "";
  let auditRequestId = "";
  let auditApprovalId: string | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    const verified = verifyLeoExecutionEnvelope(body);
    const { envelope, identity } = verified;
    auditIdentity = identity;
    auditToolKey = envelope.toolKey;
    auditRequestId = envelope.requestId;
    const approval = leoApprovalFor(identity, envelope.toolKey);
    let args = record(envelope.arguments);
    const metadata = record(args._real_estate_approval);
    const forceLimitless=envelope.toolKey.startsWith("leo.limitless.");
    const tool=assertLeoToolAllowed(identity,envelope.toolKey);
    const targetOrganization=await resolveExecutorRealEstateTarget(args,identity,forceLimitless);
    const requiresRealEstateApproval=Boolean(targetOrganization)&&!tool.readOnly;
    if (requiresRealEstateApproval && !isRealEstateApprovalTool(envelope.toolKey)) {
      throw new Error(`Unsupported consequential real-estate action: ${envelope.toolKey}`);
    }
    if (requiresRealEstateApproval) {
      auditApprovalId = text(metadata.approvalId || metadata.approval_id) || undefined;
      const token = text(metadata.token || metadata.approvalToken);
      const sessionId = text(envelope.sessionId);
      if (!envelope.approvalGranted || !auditApprovalId || !token || !sessionId) {
        await auditLeoEvent({ identity, eventType: "tool_execution_failed", toolKey: envelope.toolKey, details: { request_id: envelope.requestId, approval_id: auditApprovalId || null, status: "confirmation_required" } });
        return NextResponse.json({ ok: false, requestId: envelope.requestId, toolKey: envelope.toolKey, status: "confirmation_required", error: "A valid server-issued real-estate approval is required." }, { status: 409 });
      }
      const consumed = await consumeLeoActionApproval({ identity, organizationId: targetOrganization!.id, sessionId, channel: identity.channel, toolKey: envelope.toolKey, arguments: stripApproval(args), approvalId: auditApprovalId, token, realEstateOptIn: true });
      if (!consumed.accepted) {
        await auditLeoEvent({ identity, eventType: "tool_execution_failed", toolKey: envelope.toolKey, details: { request_id: envelope.requestId, approval_id: consumed.approvalId, status: consumed.status } });
        return NextResponse.json({ ok: false, requestId: envelope.requestId, toolKey: envelope.toolKey, status: consumed.status, approvalId: consumed.approvalId, error: "The real-estate approval is invalid, expired, already consumed, or does not match this exact action." }, { status: 409 });
      }
      args = stripApproval(args);
    } else if (envelope.approvalGranted && targetOrganization && !tool.readOnly) {
      throw new Error("Limitless Realty approval metadata is required for this consequential action.");
    }

    await auditLeoEvent({ identity, eventType: "tool_execution_started", toolKey: envelope.toolKey, details: { request_id: envelope.requestId, channel: envelope.channel, approval_id: auditApprovalId || null } });
    const result = await executeAuthorizedLeoTool({ identity, toolKey: envelope.toolKey, arguments: args, actor: identity.email || identity.userId || identity.role });
    await auditLeoEvent({ identity, eventType: "tool_execution_completed", toolKey: envelope.toolKey, details: { request_id: envelope.requestId, latency_ms: Date.now() - startedAt, approval_id: auditApprovalId || null } });
    return NextResponse.json({ ok: true, requestId: envelope.requestId, toolKey: envelope.toolKey, status: approval === "admin" ? "admin_request_recorded" : "completed", result, executionId: envelope.requestId, workflow: "leo_core_v2_executor" });
  } catch (error) {
    if (auditIdentity && auditToolKey) {
      await auditLeoEvent({ identity: auditIdentity, eventType: "tool_execution_failed", toolKey: auditToolKey, details: { request_id: auditRequestId || null, approval_id: auditApprovalId || null, status: "failed" } }).catch(() => undefined);
    }
    const message = error instanceof Error ? error.message : "Leo tool execution failed.";
    return NextResponse.json({ ok: false, status: "failed", error: message, latencyMs: Date.now() - startedAt }, { status: /Unauthorized|signature|expired|Cross-tenant|not permitted|approval/i.test(message) ? 403 : 500 });
  }
}
