import { lookup } from "node:dns/promises";
import { createHash } from "node:crypto";
import { request as httpsRequest, type RequestOptions } from "node:https";
import { isIP } from "node:net";

type DnsAddress = { address: string; family: number };

const MAX_URL_LENGTH = 2048;
const MAX_HTML_BYTES = 512 * 1024;
const MAX_TEXT_LENGTH = 12_000;
const MAX_FETCH_MS = 8_000;

export type EstateWebsiteSnapshot = {
  url: string;
  title: string;
  content: string;
  checksum: string;
  capturedAt: string;
};

export function normalizeOfficialWebsiteUrl(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || raw.length > MAX_URL_LENGTH) throw new Error("Enter one public HTTPS page URL (maximum 2,048 characters).");

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Enter a valid official website URL.");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const dnsHostname = hostname.replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:") throw new Error("Only HTTPS website pages can be imported.");
  if (url.username || url.password) throw new Error("Website URLs cannot contain a username or password.");
  if (url.port && url.port !== "443") throw new Error("Only the standard HTTPS port is allowed.");
  if (!hostname || isIP(dnsHostname) !== 0) throw new Error("Enter a public website hostname, not an IP address.");
  if (["localhost", "local", "internal", "test", "example"].some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`))) {
    throw new Error("Private and reserved website hostnames cannot be imported.");
  }

  url.hash = "";
  return url.toString();
}

export function isPublicAddress(address: string, family = isIP(address)): boolean {
  if (family === 4) {
    const octets = address.split(".").map(Number);
    if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
    const [a, b, c] = octets;
    return !(
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 2 || b === 168)) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113)
    );
  }

  if (family === 6) {
    const normalized = address.toLowerCase();
    const words = normalized.split(":");
    const firstWord = Number.parseInt(words[0] || "0", 16);
    const secondWord = Number.parseInt(words[1] || "0", 16);
    if (!Number.isFinite(firstWord) || !Number.isFinite(secondWord)) return false;
    return firstWord >= 0x2000 && firstWord <= 0x3fff &&
      firstWord !== 0x2002 &&
      !(firstWord === 0x2001 && secondWord <= 0x01ff) &&
      !(firstWord === 0x3fff && secondWord <= 0x0fff) &&
      !normalized.startsWith("2001:db8:");
  }

  return false;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([\da-f]{1,6});/gi, (_match, hex: string) => safeCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d{1,7});/g, (_match, decimal: string) => safeCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function safeCodePoint(value: number): string {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : " ";
}

function readableText(html: string): string {
  const withoutActiveContent = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|iframe|object|form|nav|header|footer|aside)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, " ")
    .replace(/<(br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|section|article|tr|td|blockquote)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ");
  return decodeHtmlEntities(withoutActiveContent).replace(/[\t\r ]+/g, " ").replace(/\n\s*/g, "\n").trim();
}

export function extractWebsiteSnapshot(html: string): { title: string; content: string } {
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  const title = titleMatch ? readableText(titleMatch[1]).slice(0, 160) : "";
  const content = readableText(html).slice(0, MAX_TEXT_LENGTH);
  if (content.length < 80) throw new Error("This page did not contain enough readable text to review.");
  return { title, content };
}

async function resolvePublicAddresses(hostname: string): Promise<DnsAddress[]> {
  let addresses: DnsAddress[];
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true }) as DnsAddress[];
  } catch {
    throw new Error("The website hostname could not be resolved.");
  }
  if (!addresses.length || addresses.some(({ address, family }) => !isPublicAddress(address, family))) {
    throw new Error("The website must resolve only to public network addresses.");
  }
  return addresses;
}

function requestHtml(url: URL, addresses: DnsAddress[]): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MAX_FETCH_MS);
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    };
    const pinnedLookup: NonNullable<RequestOptions["lookup"]> = (_hostname, options, callback) => {
      if (typeof options === "object" && options.all) callback(null, addresses);
      else callback(null, addresses[0].address, addresses[0].family);
    };
    const request = httpsRequest(url, {
      method: "GET",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-encoding": "identity",
        "user-agent": "LimitlessRealtyEstateKnowledge/1.0",
        connection: "close",
      },
      lookup: pinnedLookup,
      maxHeaderSize: 16 * 1024,
      servername: url.hostname,
      signal: controller.signal,
    }, (response) => {
      const status = response.statusCode || 0;
      if (status >= 300 && status < 400) {
        response.destroy();
        fail(new Error("The page redirected. Enter its final HTTPS URL directly; redirects are not followed."));
        return;
      }
      if (status !== 200) {
        response.destroy();
        fail(new Error(`The website returned HTTP ${status || "an invalid status"}.`));
        return;
      }
      const contentType = String(response.headers["content-type"] || "").toLowerCase();
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
        response.destroy();
        fail(new Error("Only HTML website pages can be imported."));
        return;
      }
      const contentLength = Number(response.headers["content-length"] || 0);
      if (contentLength > MAX_HTML_BYTES) {
        response.destroy();
        fail(new Error("The website page is too large to import."));
        return;
      }
      const encoding = String(response.headers["content-encoding"] || "identity").toLowerCase();
      if (encoding !== "identity") {
        response.destroy();
        fail(new Error("Compressed website responses are not accepted."));
        return;
      }

      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > MAX_HTML_BYTES) {
          request.destroy(new Error("The website page is too large to import."));
          return;
        }
        chunks.push(buffer);
      });
      response.on("end", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(Buffer.concat(chunks).toString("utf8"));
      });
      response.on("error", (error) => fail(error));
    });

    request.on("error", (error) => {
      clearTimeout(timeout);
      fail(controller.signal.aborted ? new Error("The website did not respond within eight seconds.") : error);
    });
    request.end();
  });
}

export async function fetchEstateWebsiteSnapshot(value: unknown): Promise<EstateWebsiteSnapshot> {
  const normalized = normalizeOfficialWebsiteUrl(value);
  const url = new URL(normalized);
  const addresses = await resolvePublicAddresses(url.hostname);
  const html = await requestHtml(url, addresses);
  const extracted = extractWebsiteSnapshot(html);
  const capturedAt = new Date().toISOString();
  const checksum = createHash("sha256").update(`${normalized}\n${extracted.content}`, "utf8").digest("hex");
  return { url: normalized, ...extracted, checksum, capturedAt };
}
