const DEFAULT_WHATSAPP_PART_LIMIT = 3500;

function urlRanges(value: string) {
  const ranges: Array<{ start: number; end: number }> = [];
  const urlPattern = /https?:\/\/[^\s<>()]+/gi;
  for (const match of value.matchAll(urlPattern)) {
    const start = match.index ?? -1;
    if (start < 0) continue;
    ranges.push({ start, end: start + match[0].length });
  }
  return ranges;
}

function splitInsideUrl(value: string, splitAt: number) {
  return urlRanges(value).some((range) => splitAt > range.start && splitAt < range.end);
}

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
    .filter((index) => index >= Math.floor(limit * 0.55));
  let splitAt = preferred[0] ?? limit;

  // Never split through a URL. If the selected boundary is inside one,
  // move the boundary to the start of that URL when it is safe to do so.
  if (splitInsideUrl(value, splitAt)) {
    const urlStart = urlRanges(value)
      .map((range) => range.start)
      .filter((start) => start > 0 && start <= limit)
      .sort((a, b) => b - a)[0];

    if (urlStart && urlStart >= Math.floor(limit * 0.55)) {
      splitAt = urlStart;
    } else {
      throw new Error("A campaign URL cannot be safely split across WhatsApp message parts.");
    }
  }

  if (splitInsideUrl(value, splitAt)) {
    throw new Error("A campaign URL is too long to fit safely in one WhatsApp message part.");
  }

  const isSentenceBreak = splitAt === sentenceBreak;
  return [value.slice(0, splitAt).trimEnd(), value.slice(splitAt + (isSentenceBreak ? 1 : 0)).trimStart()] as const;
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
