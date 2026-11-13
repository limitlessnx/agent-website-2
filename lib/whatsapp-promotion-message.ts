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

export function renderPromotionMessage(template: PromotionTemplate, values: Record<string, string>) {
  return template.body.replace(placeholder, (_, index) => values[template.variable_keys[Number(index) - 1]]);
}
