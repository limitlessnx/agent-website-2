"use client";

import { useCallback, useEffect, useState } from "react";

type PublicPricingPlan = {
  slug: string;
  name: string;
  currency: "NGN" | "USD";
  installationFee: number;
  recurringFee: number;
  billingInterval: string;
  custom: boolean;
};

type PublicPricingResponse = {
  detectedRegion: "NG" | "INTERNATIONAL";
  region: "NG" | "INTERNATIONAL";
  currency: "NGN" | "USD";
  canViewInternational: boolean;
  plans: PublicPricingPlan[];
};

export type PublicPriceDisplay = {
  first: string;
  ongoing: string;
  currency: "NGN" | "USD";
};

const PRICE_VIEW_KEY = "fluxknight-pricing-view";
const slugAliases: Record<string, string> = {
  "whatsapp-ai-starter": "basic",
  "ai-call-receptionist": "starter",
  "ai-front-desk-suite": "business",
  "custom-ai-operations": "business-plus",
};

function formatAmount(currency: "NGN" | "USD", amount: number) {
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function usePublicPricing() {
  const [prices, setPrices] = useState<Record<string, PublicPriceDisplay>>({});
  const [currency, setCurrency] = useState<"NGN" | "USD" | null>(null);
  const [detectedRegion, setDetectedRegion] = useState<"NG" | "INTERNATIONAL" | null>(null);
  const [region, setRegion] = useState<"NG" | "INTERNATIONAL" | null>(null);
  const [canViewInternational, setCanViewInternational] = useState(false);

  const loadPricing = useCallback((view?: "nigeria" | "international") => {
    const controller = new AbortController();
    const suffix = view === "international" ? "?view=international" : "";

    fetch(`/api/public-pricing${suffix}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Public pricing request failed");
        return (await response.json()) as PublicPricingResponse;
      })
      .then((payload) => {
        const next: Record<string, PublicPriceDisplay> = {};
        payload.plans.forEach((plan) => {
          const display = {
            first: `${plan.custom ? "From " : ""}${formatAmount(plan.currency, plan.installationFee)}`,
            ongoing: `${plan.custom ? "From " : ""}${formatAmount(plan.currency, plan.recurringFee)}/${plan.billingInterval === "monthly" ? "month" : plan.billingInterval}`,
            currency: plan.currency,
          } satisfies PublicPriceDisplay;
          next[plan.slug] = display;
          const alias = slugAliases[plan.slug];
          if (alias) next[alias] = display;
        });

        setPrices(next);
        setCurrency(payload.currency);
        setDetectedRegion(payload.detectedRegion);
        setRegion(payload.region);
        setCanViewInternational(payload.canViewInternational);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.warn("[Public Pricing] Falling back to server-rendered display", error);
      });

    return controller;
  }, []);

  useEffect(() => {
    const savedView = typeof window !== "undefined" ? window.localStorage.getItem(PRICE_VIEW_KEY) : null;
    const controller = loadPricing(savedView === "international" ? "international" : "nigeria");
    return () => controller.abort();
  }, [loadPricing]);

  const showInternational = useCallback(() => {
    if (!canViewInternational) return;
    window.localStorage.setItem(PRICE_VIEW_KEY, "international");
    loadPricing("international");
  }, [canViewInternational, loadPricing]);

  const showNigeria = useCallback(() => {
    if (detectedRegion !== "NG") return;
    window.localStorage.setItem(PRICE_VIEW_KEY, "nigeria");
    loadPricing("nigeria");
  }, [detectedRegion, loadPricing]);

  return {
    prices,
    currency,
    detectedRegion,
    region,
    canViewInternational,
    viewingInternational: detectedRegion === "NG" && region === "INTERNATIONAL",
    showInternational,
    showNigeria,
  };
}
