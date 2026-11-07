export type CampaignPhoneContact = { name: string; phone: string };

export function normalizeCampaignPhone(value: string) {
  const phone = value.trim().replace(/^tel:/i, "").replace(/[\s().-]/g, "").replace(/^00/, "+");
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export function validateCampaignContacts(value: unknown) {
  if (!Array.isArray(value) || !value.length || value.length > 500) throw new Error("Choose between 1 and 500 contacts.");
  const seen = new Set<string>();
  const contacts: CampaignPhoneContact[] = [];
  for (const [index, input] of value.entries()) {
    const name = typeof input?.name === "string" ? input.name.trim() : "";
    const phone = typeof input?.phone === "string" ? normalizeCampaignPhone(input.phone) : null;
    if (!name || name.length > 180 || !phone) throw new Error(`Contact ${index + 1}: enter a name and phone number with its country code (starting with +).`);
    if (!seen.has(phone)) contacts.push({ name, phone });
    seen.add(phone);
  }
  return { contacts, duplicates: value.length - contacts.length };
}
