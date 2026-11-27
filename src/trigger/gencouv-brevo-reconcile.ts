import { schedules } from "@trigger.dev/sdk";

export const gencouvBrevoReconcile = schedules.task({
  id: "gencouv-brevo-reconcile",
  cron: { pattern: "*/15 * * * *", environments: ["PRODUCTION"] },
  maxDuration: 75,
  run: async () => {
    const secret = process.env.GENCOUV_BREVO_RECONCILE_SECRET;
    if (!secret || secret.length < 32) return { configured: false };
    const response = await fetch("https://fluxknight.space/api/cron/gencouv-brevo-reconcile", {
      headers: { Authorization: `Bearer ${secret}` },
      redirect: "error",
      signal: AbortSignal.timeout(65000),
    });
    if (!response.ok) throw new Error(`Gencouv Brevo reconciliation returned HTTP ${response.status}`);
    return { configured: true };
  },
});
