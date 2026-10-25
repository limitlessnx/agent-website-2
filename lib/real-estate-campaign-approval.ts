import type { AdminSession } from "@/lib/admin-auth";
import type { LeoIdentity } from "@/lib/leo-core";
import type { ProgressiveLead } from "@/lib/lead-profile-service";
import type { RealEstateCampaignGroup } from "@/lib/real-estate-campaign-groups";
import type { PropertyRecord } from "@/lib/limitless-data";

export const REAL_ESTATE_CAMPAIGN_SEND_TOOL = "leo.campaign.send";

export function campaignApprovalIdentity(session: AdminSession): LeoIdentity {
  const email = String(session.email || "").trim().toLowerCase();
  if (!email || !Number.isFinite(session.issuedAt) || session.issuedAt <= 0) throw new Error("A valid signed admin session is required for campaign approval.");
  return { scope: "super_admin", role: "super_admin", email, channel: "api", globalScope: true };
}

export function campaignApprovalSessionId(session: AdminSession, organizationId: string, requestId: string) {
  const org = String(organizationId || "").trim();
  const request = String(requestId || "").trim();
  if (!org || !request) throw new Error("Campaign organization and request ID are required for approval.");
  return `dashboard-campaign:v1:${session.email.trim().toLowerCase()}:${session.issuedAt}:${org}:${request}`;
}

function stableText(value: unknown) { return String(value ?? "").trim(); }

/** Only the digest is persisted by the approval store; this binds what the operator saw to what the server will send. */
export function campaignApprovalArguments(input: {
  organizationId: string;
  requestId: string;
  campaignType: string;
  topic: string;
  message: string;
  messageParts: string[];
  templateName?: string | null;
  mediaUrl?: string | null;
  audienceMode: string;
  selectedLeadIds?: string[];
  campaignGroup?: RealEstateCampaignGroup | null;
  property?: PropertyRecord | null;
  recipients: ProgressiveLead[];
  skipped: number;
}) {
  const recipients = input.recipients.map((lead) => ({
    leadId: stableText(lead.id),
    phone: stableText(lead.phone).replace(/\D/g, ""),
    name: stableText(lead.name),
  })).sort((a, b) => a.leadId.localeCompare(b.leadId));
  const group = input.campaignGroup ? {
    id: input.campaignGroup.id,
    type: input.campaignGroup.groupType,
    leadIds: [...input.campaignGroup.leadIds].sort(),
    rules: input.campaignGroup.rules || {},
    updatedAt: input.campaignGroup.updatedAt,
  } : null;
  const property = input.property ? {
    id: input.property.id,
    title: input.property.title,
    locationArea: input.property.location_area || "",
    locationCity: input.property.location_city || "",
    price: input.property.price || "",
    type: input.property.type || "",
    status: input.property.status || "",
    image: input.property.drive_photos_link || "",
    description: input.property.description || "",
    features: input.property.features || "",
  } : null;
  return {
    organizationId: input.organizationId,
    requestId: input.requestId,
    campaignType: input.campaignType,
    topic: input.topic,
    message: input.message,
    messageParts: [...input.messageParts],
    templateName: input.templateName || null,
    mediaUrl: input.mediaUrl || null,
    audienceMode: input.audienceMode,
    selectedLeadIds: [...(input.selectedLeadIds || [])].map(String).sort(),
    campaignGroup: group,
    property,
    recipientSnapshot: recipients,
    skipped: input.skipped,
  };
}
