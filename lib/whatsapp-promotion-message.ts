import { normalizeTemplateParameter, WhatsAppMessageValidationError } from "@/lib/whatsapp-message-normalizer";

export type PromotionTemplate = {
  name: string;
  language: string;
  body: string;
  variable_keys: string[];
  header: string;
  footer: string;
  buttonLabels: string[];
};

const placeholder = /\{\{\s*(\d+)\s*\}\}/g;
const fieldLabel = (key: string) => key.replaceAll("_", " ");
const lineEndings = (text: string) => text.replace(/\r\n?/g, "\n");

export function validPromotionBody(body: string, keys: string[]) {
  if (!body.trim() || body.length > 4000 || new Set(keys).size !== keys.length ||
      keys.some(key => !/^[a-z][a-z0-9_]*$/.test(key))) return false;
  const indexes = [...body.matchAll(placeholder)].map(match => Number(match[1]));
  return indexes.length === keys.length && indexes.every((index, position) => index === position + 1)
    && !/[{}]{2}/.test(body.replace(placeholder, ""))
    && !/\}\}\s*\{\{/.test(body);
}

export function promotionDraft(template: PromotionTemplate) {
  return lineEndings(template.body).replace(placeholder, (_, index) => `{{${template.variable_keys[Number(index) - 1]}}}`);
}

export function mapPromotionMessage(template: PromotionTemplate, draft: unknown) {
  if (typeof draft !== "string" || !draft.trim() || draft.length > 4000) {
    return { error: "Enter a campaign message of up to 4,000 characters." };
  }
  const fixed = lineEndings(template.body).split(/\{\{\s*\d+\s*\}\}/g);
  const message = lineEndings(draft);
  const mismatch = "This message does not fit the approved promotion. Use the approved wording and replace only the marked fields.";
  if (!message.startsWith(fixed[0])) return { error: mismatch };
  let cursor = fixed[0].length;
  const values: Record<string, string> = {};
  for (const [index, key] of template.variable_keys.entries()) {
    const next = fixed[index + 1];
    const last = index === template.variable_keys.length - 1;
    const end = last ? message.length - next.length : message.indexOf(next, cursor);
    if (end < cursor || !message.startsWith(next, end)) return { error: mismatch };
    const value = message.slice(cursor, end);
    cursor = end + next.length;
    if (key === "customer_name") {
      if (value !== "{{customer_name}}") return { error: "Keep {{customer_name}} so each recipient sees their own name." };
      continue;
    }
    if (!value.trim() || value.trim() === `{{${key}}}`) return { error: `Enter the ${fieldLabel(key)}.` };
    if (/[{}]{2}/.test(value)) return { error: mismatch };
    try {
      values[key] = normalizeTemplateParameter(value, { maxLength: 1024, fieldName: fieldLabel(key) });
    } catch (error) {
      if (error instanceof WhatsAppMessageValidationError) return { error: error.message };
      throw error;
    }
  }
  if (cursor !== message.length) return { error: mismatch };
  return { values };
}

type PromotionFormatting = { values: Record<string, string>; error?: never } | { error: string; values?: never };

const studioFields = ["offer_title", "offer_details", "availability", "booking_action"];
const studioAvailability = /\b(?:available|availability|valid|runs? from|slots? (?:are|on|from)|appointments? (?:on|from)|open (?:on|from))\b/i;
const studioBooking = /^(?:please\s+)?(?:book|reserve|reply|call|message|contact|dm|visit|schedule|secure|send|reach out)\b/i;

function normalizePromotionValues(keys: string[], raw: Record<string, unknown>): PromotionFormatting {
  const values: Record<string, string> = {};
  for (const key of keys) {
    const value = raw[key];
    if (typeof value !== "string" || !value.trim() || /[{}]{2}/.test(value)) {
      return { error: `Include clear ${fieldLabel(key)} in the campaign message before reviewing.` };
    }
    try {
      values[key] = normalizeTemplateParameter(value, { maxLength: 1024, fieldName: fieldLabel(key) });
    } catch (error) {
      if (error instanceof WhatsAppMessageValidationError) return { error: error.message };
      throw error;
    }
  }
  return { values };
}

export function validatePromotionWriterValues(template: PromotionTemplate, message: string, raw: unknown): PromotionFormatting {
  const keys = template.variable_keys.filter(key => key !== "customer_name");
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || Object.keys(raw).length !== keys.length) {
    return { error: "The writer result is incomplete. Review the message again." };
  }
  const result = normalizePromotionValues(keys, raw as Record<string, unknown>);
  const source = normalizeTemplateParameter(message);
  if (result.values && Object.values(result.values).some(value => !source.includes(value))) {
    return { error: "The writer result contains text that is missing from the campaign message." };
  }
  return result;
}

function formatStudioPromotion(message: string) {
  const parts = message.split(/\n+|(?<=[.!?])\s+(?=[A-Z])/).map(value => value.trim()).filter(Boolean);
  if (/^(?:hi|hello|hey)(?:\b|[!,])/i.test(parts[0] || "")) {
    parts[0] = parts[0].replace(/^(?:hi|hello|hey)(?: there| everyone| team)?[!,]\s*/i, "");
    if (!parts[0]) parts.shift();
  }
  const booking = parts.filter(part => studioBooking.test(part));
  const availability = parts.filter(part => !studioBooking.test(part) && studioAvailability.test(part));
  const offer = parts.filter(part => !booking.includes(part) && !availability.includes(part));
  // Prefer an explicit title or a headline followed by the offer details.
  const headline = offer[0]?.match(/^(.{1,120}?)(?:\s+[–—-]\s+|:\s+)(.+)$/);
  const title = headline?.[1] || (offer.length > 1 ? offer[0] : "");
  const details = [headline?.[2], ...offer.slice(1)].filter(Boolean).join(" ");
  return normalizePromotionValues(studioFields, {
    offer_title: title,
    offer_details: details,
    availability: availability.length === 1 ? availability[0] : "",
    booking_action: booking.length === 1 ? booking[0] : "",
  });
}

/**
 * Convert ordinary promotional copy into the assigned Meta template's editable
 * parameters. The approved template's fixed text is never changed.
 * Keep the strict parser first for existing reviewed drafts.
 */
export function formatPromotionMessage(template: PromotionTemplate, draft: unknown): PromotionFormatting {
  const exact = mapPromotionMessage(template, draft);
  if (exact.values) return exact;
  if (typeof draft !== "string" || !draft.trim() || draft.length > 4000) {
    return { error: "Write a promotional message of up to 4,000 characters." };
  }
  const editable = template.variable_keys.filter(key => key !== "customer_name");
  if (!editable.length) return { error: "The assigned promotional template has no editable message fields." };
  const text = lineEndings(draft).trim();
  if (editable.length === studioFields.length && studioFields.every(key => editable.includes(key))) {
    return formatStudioPromotion(text);
  }
  const values: Record<string, string> = {};
  const actionKeys = editable.filter(key => /action|cta|booking|reply|contact|next_step/i.test(key));
  const contentKeys = editable.filter(key => !actionKeys.includes(key));
  // Never guess values for dates, prices or other structured placeholders.
  if (contentKeys.length > 1 || actionKeys.length > 1 || !contentKeys.length) {
    return { error: "This promotion has multiple distinct fields. Ask an administrator to configure automatic field extraction for this approved template." };
  }
  const actionMatch = actionKeys.length
    ? text.match(/(?:^|[.!?]\s+|\n)(?:book|reserve|reply|call|message|contact|dm|visit|schedule|secure|send|reach out)\b[^\n.!?]*(?:[.!?]|$)/im)
    : null;
  const clean = (value: string) => value.trim().replace(/^[\s.!?]+|[\s.!?]+$/g, "").trim();
  const action = actionMatch ? clean(actionMatch[0]) : "";
  let offer = actionMatch ? clean(text.replace(actionMatch[0], " ")) : clean(text);
  if (!offer) offer = clean(text);
  try {
    values[contentKeys[0]] = normalizeTemplateParameter(offer, { maxLength: 1024, fieldName: fieldLabel(contentKeys[0]) });
    if (actionKeys.length) {
      values[actionKeys[0]] = normalizeTemplateParameter(
        action || "Reply to this message for details",
        { maxLength: 1024, fieldName: fieldLabel(actionKeys[0]) },
      );
    }
  } catch (error) {
    if (error instanceof WhatsAppMessageValidationError) return { error: error.message };
    throw error;
  }
  return { values };
}

export function renderPromotionMessage(template: PromotionTemplate, values: Record<string, string>) {
  return template.body.replace(placeholder, (_, index) => values[template.variable_keys[Number(index) - 1]]);
}
