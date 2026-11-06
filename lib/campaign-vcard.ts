type PreviewContact = { name: string; phone: string; email?: string };

function decodeVCardValue(value: string, params: string[]) {
  let decoded = value;
  if (params.some((param) => /ENCODING=(?:QUOTED-PRINTABLE|QP)/i.test(param))) {
    const bytes: number[] = [];
    for (let index = 0; index < decoded.length; index += 1) {
      if (decoded[index] === "=" && /^[0-9A-F]{2}$/i.test(decoded.slice(index + 1, index + 3))) {
        bytes.push(parseInt(decoded.slice(index + 1, index + 3), 16));
        index += 2;
      } else {
        bytes.push(decoded.charCodeAt(index) & 0xff);
      }
    }
    try { decoded = new TextDecoder("utf-8").decode(new Uint8Array(bytes)); } catch { /* retain readable source value */ }
  }
  return decoded
    .replace(/\\[nN]/g, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

export function parseVCard(source: string): PreviewContact[] {
  // vCard permits folded lines and optional group prefixes (for example item1.TEL).
  const unfolded = source
    .replace(/^\\uFEFF/, "")
    .replace(/\r\n[ \t]/g, "")
    .replace(/\n[ \t]/g, "")
    .replace(/\r(?=[^\n])/g, "\n");
  return unfolded.split(/(?=BEGIN:VCARD)/i)
    .filter((card) => /BEGIN:VCARD/i.test(card))
    .map((card) => {
      const lines = card.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const properties = lines.flatMap((line) => {
        const colon = line.indexOf(":");
        if (colon < 0) return [];
        const left = line.slice(0, colon);
        const value = line.slice(colon + 1);
        const parts = left.split(";");
        const property = (parts.shift() || "").split(".").pop()?.toUpperCase() || "";
        return [{ property, params: parts, value }];
      });
      const values = (property: string) => properties.filter((item) => item.property === property);
      const fn = values("FN")[0];
      const n = values("N")[0];
      const name = fn
        ? decodeVCardValue(fn.value, fn.params)
        : n
          ? decodeVCardValue((() => { const [family, given, middle, prefix, suffix] = n.value.split(";"); return [prefix, given, middle, family, suffix].filter(Boolean).join(" "); })(), n.params)
          : "";
      const phones = values("TEL").map((item) => ({
        value: decodeVCardValue(item.value, item.params),
        preferred: item.params.some((param) => /TYPE=.*(?:CELL|MOBILE)/i.test(param)) || item.params.some((param) => /PREF/i.test(param)),
      })).filter((item) => item.value);
      const phone = (phones.find((item) => item.preferred) || phones[0])?.value || "";
      const emailItem = values("EMAIL")[0];
      const email = emailItem ? decodeVCardValue(emailItem.value, emailItem.params) : "";
      return { name, phone, email };
    })
    .filter((contact) => contact.name && contact.phone);
}

