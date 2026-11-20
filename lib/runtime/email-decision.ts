export const EMAIL_WORKFLOW = "outbound_email_crm_v5";
export const EMAIL_RESERVATION_SOURCE = "outbound_email_runtime";
export const EMAIL_INSTRUCTIONS = "Use only supplied tenant knowledge, CRM state, campaign rules and contact context. Never invent facts. Respect suppression and opt-out policy.";

const string = { type: "string" };
const nullableString = { type: ["string", "null"] };
const boolean = { type: "boolean" };
const properties = {
  action: { enum: ["send", "skip", "reschedule", "handoff", "stop"], type: "string" },
  subject: nullableString,
  message: nullableString,
  reason: string,
  lead_stage: { enum: ["new", "contacted", "qualified", "nurturing", "appointment", "won", "lost", "disqualified"], type: "string" },
  next_step: { type: ["integer", "null"] },
  next_send_at: { ...nullableString, description: "ISO-8601 date and time, or null." },
  reply_classification: { enum: ["interested", "not_interested", "question", "objection", "unsubscribe", "out_of_office", "bounce", "other", null], type: ["string", "null"] },
  priority: { enum: ["low", "normal", "high", "urgent"], type: "string" },
  handoff_required: boolean,
  handoff_reason: nullableString,
  stop_sequence: boolean,
  memory_facts: {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      properties: { type: { type: "string", enum: ["campaign", "preference", "objection", "fact"] }, summary: string, confidence: { type: "number", minimum: 0, maximum: 1 } },
      required: ["type", "summary", "confidence"],
    },
  },
};

export const EMAIL_DECISION_SCHEMA = { type: "object", additionalProperties: false, properties, required: Object.keys(properties) };

export function isEmailFollowUp(eventType: string, sequenceStep: number) {
  return sequenceStep > 1 || eventType.toLowerCase().includes("follow");
}

export function readEmailDecisionInput(value: unknown) {
  const input: unknown = typeof value === "string" ? JSON.parse(value) : value;
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid email decision input.");
  return input as Record<string, unknown>;
}
