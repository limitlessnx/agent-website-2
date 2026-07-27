const DEFAULT_WHATSAPP_PART_LIMIT = 3500;

function takeSafeSlice(value: string, limit: number) {
  if (value.length <= limit) return [value, ""] as const;

  const candidate = value.slice(0, limit);
  const paragraphBreak = candidate.lastIndexOf("\n\n");
  const lineBreak = candidate.lastIndexOf("\n");
  const sentenceBreak = Math.max(
    candidate.lastIndexOf(". "),
    candidate.lastIndexOf("! "),
    candidate.lastIndexOf("? "),
  );
  const spaceBreak = candidate.lastIndexOf(" ");

  const preferred = [paragraphBreak, lineBreak, sentenceBreak, spaceBreak]
    .find((index) => index >= Math.floor(limit * 0.55));
  const splitAt = preferred === undefined ? limit : preferred + (preferred === sentenceBreak ? 1 : 0);

  return [value.slice(0, splitAt).trimEnd(), value.slice(splitAt).trimStart()] as const;
}

export function splitWhatsAppMessage(
  message: string,
  limit = DEFAULT_WHATSAPP_PART_LIMIT,
) {
  const clean = String(message || "").trim();
  if (!clean) return [];
  if (!Number.isFinite(limit) || limit < 500) {
    throw new Error("WhatsApp message part limit must be at least 500 characters.");
  }

  const parts: string[] = [];
  let remaining = clean;

  while (remaining.length > limit) {
    const [part, rest] = takeSafeSlice(remaining, limit);
    if (!part || rest === remaining) {
      throw new Error("Unable to split the WhatsApp campaign message safely.");
    }
    parts.push(part);
    remaining = rest;
  }

  if (remaining) parts.push(remaining);
  return parts;
}
