"use client";

import { useEffect, useState } from "react";

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
  region: "NG" | "INTERNATIONAL";
  currency: "NGN" | "USD";
  plans: PublicPricingPlan[];
};

export type PublicPriceDisplay = {
  first: string;
  ongoing: string;
  currency: "NGN" | "USD";
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

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetch("/api/public-pricing", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Public pricing request failed");
        return (await response.json()) as PublicPricingResponse;
      })
      .then((payload) => {
        if (!active) return;
        const next: Record<string, PublicPriceDisplay> = {};
        payload.plans.forEach((plan) => {
          if (plan.custom) return;
          next[plan.slug] = {
            first: formatAmount(plan.currency, plan.installationFee),
            ongoing: `${formatAmount(plan.currency, plan.recurringFee)}/${plan.billingInterval === "monthly" ? "month" : plan.billingInterval}`,
            currency: plan.currency,
          };
        });
        setPrices(next);
        setCurrency(payload.currency);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.warn("[Public Pricing] Falling back to server-rendered display", error);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  return { prices, currency };
}
