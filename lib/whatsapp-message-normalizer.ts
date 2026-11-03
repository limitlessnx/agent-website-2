/**
 * Shared WhatsApp message normalisation.
 *
 * Template parameters are single text values: control characters and line breaks
 * are converted to spaces and whitespace is collapsed. Direct-session messages
 * retain intentional paragraph breaks. Neither path silently truncates content.
 */
export class WhatsAppMessageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhatsAppMessageValidationError";
  }
}

function stripUnsafeControls(value: string) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

export function normalizeTemplateParameter(value: unknown, options: { maxLength?: number; fieldName?: string } = {}) {
  const fieldName = options.fieldName || "Template variable";
  const normalized = stripUnsafeControls(String(value ?? "").normalize("NFC"))
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) throw new WhatsAppMessageValidationError(\`\${fieldName} is required and cannot be empty.\`);
  if (options.maxLength && normalized.length > options.maxLength) {
    throw new WhatsAppMessageValidationError(\`\${fieldName} is too long (\${normalized.length}/\${options.maxLength} characters). Shorten it before sending.\`);
  }
  return normalized;
}

export function normalizeDirectMessage(value: unknown, maxLength = 4096) {
  const normalized = stripUnsafeControls(String(value ?? "").normalize("NFC"))
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \f\v]+/g, " ").trim())
    .join("\n")
    .trim();
  if (!normalized) throw new WhatsAppMessageValidationError("Message text is required.");
  if (normalized.length > maxLength) {
    throw new WhatsAppMessageValidationError(\`Message is too long (\${normalized.length}/\${maxLength} characters). Shorten it before sending.\`);
  }
  return normalized;
}

export function normalizeTemplateVariables(
  keys: readonly string[],
  values: Record<string, string | number | null | undefined>,
  maxLength = 1024,
) {
  const result: Record<string, string> = {};
  for (const key of keys) {
    result[key] = normalizeTemplateParameter(values[key], { maxLength, fieldName: \`Template variable "\${key}"\` });
  }
  return result;
}
