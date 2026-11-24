/** Names must come from explicit contact data, never inferred from an email address. */
export function cleanGencouvContactName(value: unknown) {
  if (typeof value !== "string") return "";
  const name = value.normalize("NFC").replace(/\s+/gu, " ").trim().slice(0, 200);
  if (!/\p{L}/u.test(name) || /@|https?:\/\//i.test(name) || /^(?:n\/?a|unknown|none|null|undefined|not provided)$/i.test(name)) return "";
  return name;
}

/** The same literal replacement is used for recipient previews and provider payloads. */
export function personalizeGencouvMessage(text: string, name?: string | null) {
  return text.replace(/\[Name\]/gi, () => name?.trim() || "there");
}
