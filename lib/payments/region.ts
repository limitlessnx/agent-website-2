import { headers } from "next/headers";

export type BillingRegion = "NG" | "INTERNATIONAL";
export type BillingCurrency = "NGN" | "USD";

const NIGERIA_LANGUAGES = ["en-ng", "yo-ng", "ig-ng", "ha-ng"];

export function resolveBillingRegionFromHeaders(input: Headers): BillingRegion {
  const country = (input.get("x-vercel-ip-country") || input.get("cf-ipcountry") || "").trim().toUpperCase();
  if (country === "NG") return "NG";

  const language = (input.get("accept-language") || "").toLowerCase();
  if (NIGERIA_LANGUAGES.some((value) => language.includes(value))) return "NG";

  return "INTERNATIONAL";
}

export function currencyForRegion(region: BillingRegion): BillingCurrency {
  return region === "NG" ? "NGN" : "USD";
}

export async function getRequestBillingRegion() {
  const requestHeaders = await headers();
  const region = resolveBillingRegionFromHeaders(requestHeaders);
  return { region, currency: currencyForRegion(region) };
}
