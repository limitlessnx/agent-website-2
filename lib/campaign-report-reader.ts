export type CampaignRecipientStatus = {
  name: string;
  phone: string;
  message_id: string;
  status: string;
  error_code?: string;
  error_message?: string;
};

export type DetailedCampaignReport = {
  id: string;
  organization_id: string;
  campaign_type: string;
  template_name: string;
  campaign_topic: string;
  status: string;
  attempted: number;
  accepted: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  skipped: number;
  pending_delivery: number;
  unresolved: number;
  final_status_note?: string;
  execution_id?: string;
  created_at: string;
  recipients: CampaignRecipientStatus[];
};

type TrackingRow = {
  id: string;
  organization_id: string;
  outbound_kind: string;
  idempotency_key: string;
  campaign_id?: string | null;
  recipient?: string | null;
  provider?: string | null;
  provider_message_id?: string | null;
  lifecycle_status?: string | null;
  delivery_status?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown> | string | null;
  created_at?: string;
  updated_at?: string;
};

function config() {
  const url = (process.env.LIMITLESS_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  if (!url || !key) throw new Error("Tenant-scoped campaign report configuration is missing.");
  return { url, key };
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) { return String(value ?? "").trim(); }
function number(value: unknown) { const result = Number(value); return Number.isFinite(result) && result >= 0 ? result : 0; }
function normalized(value: unknown) { return text(value).toLowerCase(); }

function maskedRecipient(value: unknown) {
  const digits = text(value).replace(/\D/g, "");
  return digits.length >= 4 ? `•••${digits.slice(-4)}` : "";
}

export function projectCampaignReports(organizationId: string, parentRows: TrackingRow[], recipientRows: TrackingRow[], limit = 50, attemptRows: Array<TrackingRow & { status?: string; request_payload?: Record<string, unknown> | string }> = []): DetailedCampaignReport[] {
  if (!organizationId) throw new Error("Organization ID is required to read campaign reports.");
  const parents = parentRows
    .filter((row) => row.organization_id === organizationId && row.outbound_kind === "campaign")
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .slice(0, Math.max(1, Math.min(limit, 100)));
  const children = recipientRows.filter((row) => row.organization_id === organizationId && row.outbound_kind === "campaign_recipient");

  return parents.map((parent) => {
    const campaignId = text(parent.campaign_id || parent.id);
    const trackingRows = children.filter((row) => String(row.campaign_id || "") === campaignId);
    const campaignDispatchRows = attemptRows.filter((row) => {
      if (row.organization_id !== organizationId) return false;
      const request = object((row as TrackingRow & { request_payload?: Record<string, unknown> | string }).request_payload);
      return text(request.campaign_id) === campaignId;
    });
    const campaignMessageIds = new Set(campaignDispatchRows.map((row) => {
      const response = object((row as TrackingRow & { response_payload?: Record<string, unknown> | string }).response_payload);
      return text(row.provider_message_id || (row as TrackingRow & { response_message_id?: string }).response_message_id || response.providerMessageId);
    }).filter(Boolean));
    const campaignAttempts = attemptRows.filter((row) => {
      if (row.organization_id !== organizationId) return false;
      const request = object((row as TrackingRow & { request_payload?: Record<string, unknown> | string }).request_payload);
      const response = object((row as TrackingRow & { response_payload?: Record<string, unknown> | string }).response_payload);
      const id = text(row.provider_message_id || (row as TrackingRow & { response_message_id?: string }).response_message_id || response.providerMessageId);
      return text(request.campaign_id) === campaignId || Boolean(id && campaignMessageIds.has(id));
    });
    // Webhook receipts update whatsapp_delivery_attempts. Merge those receipts
    // by provider message ID so a callback is not lost from the report merely
    // because the campaign-recipient row was written on a later async step.
    const attemptByMessageId = new Map<string, TrackingRow>();
    for (const attempt of campaignAttempts) {
      const response = object((attempt as TrackingRow & { response_payload?: Record<string, unknown> | string }).response_payload);
      const id = text(attempt.provider_message_id || (attempt as TrackingRow & { response_message_id?: string }).response_message_id || response.providerMessageId);
      if (id) {
        const existing = attemptByMessageId.get(id);
        const nextStatus = text(attempt.status) || "unknown";
        // Dispatch acceptance is not a delivery receipt and must never replace
        // a sent/delivered/read/failed webhook status, even if written later.
        if (!(normalized(nextStatus) === "accepted" && existing && normalized(existing.delivery_status) !== "accepted")) {
          attemptByMessageId.set(id, { ...attempt, provider_message_id: id, delivery_status: nextStatus, error_code: attempt.error_code, error_message: attempt.error_message });
        }
      }
    }
    const rowsByMessageId = new Map<string, TrackingRow>();
    for (const row of trackingRows) {
      const id = text(row.provider_message_id);
      const receipt = id ? attemptByMessageId.get(id) : undefined;
      rowsByMessageId.set(id || row.id, receipt ? { ...row, delivery_status: receipt.delivery_status, error_code: receipt.error_code, error_message: receipt.error_message } : row);
    }
    for (const [id, attempt] of attemptByMessageId) if (!rowsByMessageId.has(id)) rowsByMessageId.set(id, attempt);
    const rows = [...rowsByMessageId.values()];
    const metadata = object(parent.metadata);
    const response = object(metadata.response);
    const attempted = number(metadata.attempted ?? response.attempted);
    const acceptedRows = rows.filter((row) => Boolean(text(row.provider_message_id)) || ["accepted", "sent", "delivered", "read"].includes(normalized(row.delivery_status)));
    const deliveredRows = rows.filter((row) => ["delivered", "read"].includes(normalized(row.delivery_status)));
    const readRows = rows.filter((row) => normalized(row.delivery_status) === "read");
    const sentRows = rows.filter((row) => ["sent", "delivered", "read"].includes(normalized(row.delivery_status)));
    const failedRows = rows.filter((row) => normalized(row.delivery_status) === "failed" || normalized(row.lifecycle_status) === "failed");
    const providerFailed = number(response.failed);
    const failed = rows.length > 0 ? failedRows.length : providerFailed;
    const accepted = acceptedRows.length || number(response.accepted ?? response.sent);
    const skipped = number(response.skipped);
    const delivered = deliveredRows.length;
    const pending = Math.max(0, accepted - delivered - failedRows.length);
    const unresolved = rows.filter((row) => ["unknown", "", "accepted", "sent"].includes(normalized(row.delivery_status))).length + Math.max(0, accepted - rows.length);
    const partial = accepted > 0 && (failed > 0 || unresolved > 0 || (delivered > 0 && delivered < accepted));
    const status = failed > 0 ? accepted > failed ? "partially_failed_after_acceptance" : "failed_after_acceptance"
      : accepted > 0 && delivered === accepted ? "delivered"
      : accepted > 0 ? "delivery_pending"
      : normalized(parent.lifecycle_status) === "failed" ? "failed"
      : "unknown";
    const failureNote = failedRows.map((row) => text(row.error_message)).find(Boolean) || undefined;

    return {
      id: campaignId,
      organization_id: organizationId,
      campaign_type: text(response.campaignType || metadata.campaignType) || "real_estate_campaign",
      template_name: text(response.templateName || metadata.templateName),
      campaign_topic: text(response.topic || metadata.topic) || "WhatsApp campaign",
      status: partial && delivered > 0 ? "partially_delivered" : status,
      attempted: attempted || accepted + failed + skipped,
      accepted,
      sent: sentRows.length,
      delivered,
      read: readRows.length,
      failed,
      skipped,
      pending_delivery: pending,
      unresolved,
      final_status_note: failureNote,
      execution_id: text(response.executionId || response.execution_id || "") || undefined,
      created_at: parent.created_at || String(metadata.created_at || ""),
      recipients: rows.slice(0, 1000).map((row) => ({
        name: "Recipient",
        phone: maskedRecipient(row.recipient),
        message_id: text(row.provider_message_id),
        status: text(row.delivery_status || "unknown"),
        error_code: text(row.error_code) || undefined,
        error_message: text(row.error_message) || undefined,
      })),
    };
  });
}

async function fetchRows(url: string, key: string, rangeStart: number, rangeEnd: number): Promise<TrackingRow[]> {
  const response = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json", "Range-Unit": "items", Range: `${rangeStart}-${rangeEnd}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Campaign report query failed (${response.status}).`);
  return await response.json() as TrackingRow[];
}

async function fetchAllPages(url: string, key: string, pageSize: number, maxRows: number) {
  const all: TrackingRow[] = [];
  for (let start = 0; start < maxRows; start += pageSize) {
    const page = await fetchRows(url, key, start, Math.min(start + pageSize - 1, maxRows - 1));
    all.push(...page);
    if (page.length < pageSize) break;
  }
  return all;
}

export async function getDetailedCampaignReports(organizationId: string, limit = 50): Promise<DetailedCampaignReport[]> {
  if (!organizationId) throw new Error("Organization ID is required to read campaign reports.");
  const { url, key } = config();
  const org = encodeURIComponent(organizationId);
  const columns = "id,organization_id,outbound_kind,idempotency_key,campaign_id,recipient,provider,provider_message_id,lifecycle_status,delivery_status,error_code,error_message,metadata,created_at,updated_at";
  const parentUrl = `${url}/rest/v1/real_estate_outbound_tracking?select=${columns}&organization_id=eq.${org}&outbound_kind=eq.campaign&order=created_at.desc&limit=${Math.max(1, Math.min(limit, 100))}`;
  const parentRows = await fetchRows(parentUrl, key, 0, Math.max(1, Math.min(limit, 100)) - 1);
  if (!parentRows.length) return [];
  const campaignIds = [...new Set(parentRows.map((row) => String(row.campaign_id || "")).filter((id) => /^[a-zA-Z0-9_-]{1,160}$/.test(id)))];
  if (!campaignIds.length) return projectCampaignReports(organizationId, parentRows, [], limit);
  const inFilter = `(${campaignIds.join(",")})`;
  const childUrl = `${url}/rest/v1/real_estate_outbound_tracking?select=${columns}&organization_id=eq.${org}&outbound_kind=eq.campaign_recipient&campaign_id=in.${encodeURIComponent(inFilter)}&order=created_at.asc&limit=10000`;
  const recipientRows = await fetchAllPages(childUrl, key, 1000, 10000);

  // Dispatch rows carry campaign_id; Meta webhook receipt rows do not. First
  // resolve this campaign's provider IDs, then fetch every receipt for those IDs.
  const attemptColumns = "id,organization_id,recipient,provider_message_id,response_message_id,status,error_code,error_message,request_payload,response_payload,created_at";
  const attemptRows: Array<TrackingRow & { status?: string; request_payload?: Record<string, unknown> | string }> = [];
  for (const campaignId of campaignIds) {
    const containment = encodeURIComponent(JSON.stringify({ campaign_id: campaignId }));
    const dispatchUrl = `${url}/rest/v1/whatsapp_delivery_attempts?select=${attemptColumns}&organization_id=eq.${org}&request_payload=cs.${containment}&order=created_at.asc&limit=10000`;
    const dispatchRows = await fetchAllPages(dispatchUrl, key, 1000, 10000) as Array<TrackingRow & { status?: string; request_payload?: Record<string, unknown> | string }>;
    const messageIds = [...new Set(dispatchRows.map((row) => {
      const response = object((row as TrackingRow & { response_payload?: Record<string, unknown> | string }).response_payload);
      return text(row.provider_message_id || response.providerMessageId);
    }).filter(Boolean))];
    attemptRows.push(...dispatchRows);
    if (messageIds.length) {
      const messageFilter = `(${messageIds.map((id) => `"${id.replace(/"/g, "\\\"")}"`).join(",")})`;
      const receiptUrl = `${url}/rest/v1/whatsapp_delivery_attempts?select=${attemptColumns}&organization_id=eq.${org}&provider_message_id=in.${encodeURIComponent(messageFilter)}&order=created_at.asc&limit=10000`;
      attemptRows.push(...await fetchAllPages(receiptUrl, key, 1000, 10000) as Array<TrackingRow & { status?: string; request_payload?: Record<string, unknown> | string }>);
    }
  }
  return projectCampaignReports(organizationId, parentRows, recipientRows, limit, attemptRows);
}
