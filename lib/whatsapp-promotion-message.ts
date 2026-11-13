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

/**
 * Convert ordinary promotional copy into the assigned Meta template's editable
 * parameters. The approved template's fixed text is never changed.
 * Keep the strict parser first for existing reviewed drafts.
 */
export function formatPromotionMessage(template: PromotionTemplate, draft: unknown) {
  const exact = mapPromotionMessage(template, draft);
  if (exact.values) return exact;
  if (typeof draft !== "string" || !draft.trim() || draft.length > 4000) {
    return { error: "Write a promotional message of up to 4,000 characters." };
  }
  const editable = template.variable_keys.filter(key => key !== "customer_name");
  if (!editable.length) return { error: "The assigned promotional template has no editable message fields." };
  const text = lineEndings(draft).trim();
  const values: Record<string, string> = {};
  const actionKeys = editable.filter(key => /action|cta|booking|reply|contact|next_step/i.test(key));
  const contentKeys = editable.filter(key => !actionKeys.includes(key));
  // Never guess values for dates, prices or other structured placeholders.
  if (contentKeys.length > 1 || actionKeys.length > 1 || !contentKeys.length) {
    return { error: "This promotion has multiple distinct fields. Ask an administrator to configure automatic field extraction for this approved template." };
  }
  const actionMatch = text.match(/(?:^|[.!?]\s+|\n)(?:book|reserve|reply|call|message|contact|dm|visit|schedule|secure|send|reach out)\b[^\n.!?]*(?:[.!?]|$)/im);
  let offer = text;
  if (actionKeys.length && actionMatch) offer = text.replace(actionMatch[0], " ").replace(/\s+/g, " ").trim();
  if (!offer) offer = text;
  try {
    values[contentKeys[0]] = normalizeTemplateParameter(offer, { maxLength: 1024, fieldName: fieldLabel(contentKeys[0]) });
    if (actionKeys.length) {
      values[actionKeys[0]] = normalizeTemplateParameter(
        actionMatch?.[0]?.trim() || "Reply to this message for details",
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
