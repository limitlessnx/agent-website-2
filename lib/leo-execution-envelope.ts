import { createHmac, timingSafeEqual } from "node:crypto";
import {
  assertLeoToolAllowed,
  enforceLeoOrganizationScope,
  type LeoChannel,
  type LeoIdentity,
  type LeoRole,
  type LeoScope,
} from "@/lib/leo-core";

export type LeoExecutionEnvelope = {
  version: 2;
  requestId: string;
  issuedAt: number;
  expiresAt: number;
  sessionId?: string | null;
  channel: LeoChannel;
  toolKey: string;
  arguments: Record<string, unknown>;
  approvalGranted: boolean;
  identity: {
    scope: LeoScope;
    role: LeoRole;
    userId?: string | null;
    email?: string | null;
    organizationId?: string | null;
    membershipId?: string | null;
    globalScope: boolean;
  };
  signature: string;
};

function secret() {
  return (
    process.env.LEO_EXECUTION_SIGNING_SECRET ||
    process.env.LEO_N8N_SHARED_SECRET ||
    process.env.RUNTIME_GATEWAY_SECRET ||
    ""
  ).trim();
}

function hashArguments(value: Record<string, unknown>) {
  return createHmac("sha256", secret()).update(JSON.stringify(value)).digest("hex");
}

function signatureInput(value: Omit<LeoExecutionEnvelope, "signature">) {
  return [
    value.version,
    value.requestId,
    value.issuedAt,
    value.expiresAt,
    value.sessionId || "",
    value.channel,
    value.toolKey,
    value.identity.scope,
    value.identity.role,
    value.identity.userId || "",
    value.identity.organizationId || "",
    value.identity.membershipId || "",
    value.identity.globalScope ? "1" : "0",
    value.approvalGranted ? "1" : "0",
    hashArguments(value.arguments),
  ].join("|");
}

function sign(value: Omit<LeoExecutionEnvelope, "signature">) {
  const key = secret();
  if (!key) throw new Error("Leo execution signing secret is not configured.");
  return createHmac("sha256", key).update(signatureInput(value)).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createLeoExecutionEnvelope(input: {
  requestId: string;
  sessionId?: string | null;
  identity: LeoIdentity;
  toolKey: string;
  arguments: Record<string, unknown>;
  approvalGranted?: boolean;
}) {
  const tool = assertLeoToolAllowed(input.identity, input.toolKey);
  const scopedArguments = { ...input.arguments };
  if (input.identity.scope === "tenant") {
    scopedArguments.organization_id = enforceLeoOrganizationScope(
      input.identity,
      typeof scopedArguments.organization_id === "string" ? scopedArguments.organization_id : undefined,
    );
  }
  if (input.identity.scope === "public") {
    delete scopedArguments.organization_id;
    delete scopedArguments.organizationId;
    delete scopedArguments.tenant_id;
    delete scopedArguments.tenantId;
  }

  const issuedAt = Date.now();
  const unsigned: Omit<LeoExecutionEnvelope, "signature"> = {
    version: 2,
    requestId: input.requestId,
    issuedAt,
    expiresAt: issuedAt + 2 * 60 * 1000,
    sessionId: input.sessionId || null,
    channel: input.identity.channel,
    toolKey: tool.key,
    arguments: scopedArguments,
    approvalGranted: Boolean(input.approvalGranted),
    identity: {
      scope: input.identity.scope,
      role: input.identity.role,
      userId: input.identity.userId || null,
      email: input.identity.email || null,
      organizationId: input.identity.organizationId || null,
      membershipId: input.identity.membershipId || null,
      globalScope: input.identity.globalScope,
    },
  };
  return { ...unsigned, signature: sign(unsigned) } satisfies LeoExecutionEnvelope;
}

export function verifyLeoExecutionEnvelope(value: unknown): {
  envelope: LeoExecutionEnvelope;
  identity: LeoIdentity;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Leo execution envelope.");
  const envelope = value as LeoExecutionEnvelope;
  if (envelope.version !== 2 || !envelope.requestId || !envelope.toolKey || !envelope.signature) {
    throw new Error("Incomplete Leo execution envelope.");
  }
  if (!Number.isFinite(envelope.issuedAt) || !Number.isFinite(envelope.expiresAt) || Date.now() > envelope.expiresAt) {
    throw new Error("Leo execution envelope expired.");
  }
  const { signature, ...unsigned } = envelope;
  if (!safeEqual(signature, sign(unsigned))) throw new Error("Leo execution signature is invalid.");

  const identity: LeoIdentity = {
    scope: envelope.identity.scope,
    role: envelope.identity.role,
    userId: envelope.identity.userId || undefined,
    email: envelope.identity.email || undefined,
    organizationId: envelope.identity.organizationId || undefined,
    membershipId: envelope.identity.membershipId || undefined,
    channel: envelope.channel,
    globalScope: Boolean(envelope.identity.globalScope),
  };
  assertLeoToolAllowed(identity, envelope.toolKey);
  if (identity.scope === "tenant") {
    enforceLeoOrganizationScope(
      identity,
      typeof envelope.arguments.organization_id === "string" ? envelope.arguments.organization_id : undefined,
    );
  }
  return { envelope, identity };
}
