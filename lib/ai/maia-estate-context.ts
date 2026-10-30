export type VerifiedPropertyMatch = { id?: unknown; title?: unknown };

const normalize = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");

function parseVerifiedMatches(message: string): VerifiedPropertyMatch[] {
  const marker = "VERIFIED LIMITLESS REALTY PROPERTY SEARCH RESULT:";
  const markerIndex = message.indexOf(marker);
  if (markerIndex < 0) return [];
  const jsonStart = message.indexOf("{", markerIndex + marker.length);
  if (jsonStart < 0) return [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let jsonEnd = -1;
  for (let index = jsonStart; index < message.length; index += 1) {
    const char = message[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) { jsonEnd = index + 1; break; }
    }
  }
  if (jsonEnd < 0) return [];
  try {
    const parsed = JSON.parse(message.slice(jsonStart, jsonEnd)) as { matches?: unknown };
    return Array.isArray(parsed.matches) ? parsed.matches.filter((item): item is VerifiedPropertyMatch => Boolean(item && typeof item === "object")) : [];
  } catch {
    return [];
  }
}

/**
 * Resolve only a property explicitly named in the customer's text against the
 * trusted, tenant-scoped property-search payload appended by the WhatsApp route.
 * Ambiguous matches deliberately return null instead of guessing an estate.
 */
export function resolveNamedVerifiedPropertyId(message: string): string | null {
  const markerIndex = message.indexOf("VERIFIED LIMITLESS REALTY PROPERTY SEARCH RESULT:");
  const customerText = markerIndex >= 0 ? message.slice(0, markerIndex) : message;
  const normalizedMessage = normalize(customerText);
  if (!normalizedMessage) return null;

  const scored = parseVerifiedMatches(message).flatMap((match) => {
    const id = typeof match.id === "string" ? match.id.trim() : "";
    const rawTitle = typeof match.title === "string" ? match.title.trim() : "";
    if (!id || !rawTitle) return [];
    // Catalog titles sometimes append a city after a period. Keep the actual
    // estate/property name as the matching phrase.
    const title = normalize(rawTitle.split(".")[0]);
    const tokens = title.split(" ").filter((token) => token.length > 1);
    if (!tokens.length) return [];
    const messageTokens = normalizedMessage.split(" ");
    const matched = tokens.filter((token) => messageTokens.includes(token)).length;
    const ratio = matched / tokens.length;
    const compactTitle = title.replace(/ /g, "");
    const compactMessage = normalizedMessage.replace(/ /g, "");
    // Customers often type brand names as one word ("dprince builders")
    // while catalog titles preserve spacing ("D Prince Builders Diamond Estate").
    // Match a distinctive catalog-name prefix anywhere in the customer's
    // sentence, not only when the entire sentence is the estate name.
    // Generic short suffixes such as "diamond estate" remain non-matching.
    const distinctivePrefix = compactTitle.length >= 10 &&
      compactMessage.includes(compactTitle.slice(0, Math.min(14, compactTitle.length)));
    if (!distinctivePrefix && (ratio < 0.75 || matched < Math.min(3, tokens.length))) return [];
    return [{ id, score: distinctivePrefix ? 2000 + compactMessage.length : ratio * 1000 + tokens.length }];
  }).sort((left, right) => right.score - left.score);

  if (!scored.length || (scored[1] && scored[1].score === scored[0].score)) return null;
  return scored[0].id;
}
