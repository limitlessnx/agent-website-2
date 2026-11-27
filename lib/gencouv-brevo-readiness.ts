import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GENCOUV_CAMPAIGN_KEY, GENCOUV_EMAIL } from "@/lib/gencouv-admin";
import { isBrevoSenderAddress } from "@/lib/gencouv-brevo";

const DAILY_TARGET = 300;

export function gencouvBrevoTestRecipients() {
  return (process.env.GENCOUV_BREVO_TEST_RECIPIENTS ?? "").split(",")
    .map(value => value.trim().toLowerCase())
    .filter(value => value.length <= 254 && GENCOUV_EMAIL.test(value))
    .slice(0, 2);
}

export async function readGencouvBrevoAllowlist(db: SupabaseClient, organizationId: string): Promise<string[]> {
  const result = await db.from("gencouv_campaign_settings").select("metadata")
    .eq("organization_id", organizationId).eq("campaign_key", GENCOUV_CAMPAIGN_KEY).maybeSingle();
  if (result.error) throw new Error("Gencouv sender configuration unavailable.");
  const allowed: unknown = result.data?.metadata?.brevo_approved_senders;
  return Array.isArray(allowed) ? [...new Set(allowed.filter(isBrevoSenderAddress))] : [];
}

export async function readGencouvBrevoReadiness(db: SupabaseClient, organizationId: string) {
  const key = process.env.GENCOUV_BREVO_API_KEY;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const [allowed, usage] = await Promise.all([
    readGencouvBrevoAllowlist(db, organizationId),
    db.from("gencouv_send_batches").select("provider,recipient_count").eq("organization_id", organizationId)
      .gte("created_at", start.toISOString()).not("status", "in", "(failed,cancelled)"),
  ]);
  const used = usage.error ? null : (usage.data ?? []).filter(row => row.provider === "brevo")
    .reduce((total, row) => total + Number(row.recipient_count), 0);
  const resendUsed = usage.error ? null : (usage.data ?? []).filter(row => row.provider === "resend")
    .reduce((total, row) => total + Number(row.recipient_count), 0);
  const activationEnabled = process.env.GENCOUV_BREVO_SENDING_ENABLED === "true";
  const deliveryVerified = process.env.GENCOUV_BREVO_DELIVERY_VERIFIED === "true";
  const trackingConfigured = (process.env.GENCOUV_BREVO_WEBHOOK_SECRET ?? "").length >= 32 &&
    (process.env.GENCOUV_BREVO_RECONCILE_SECRET ?? "").length >= 32;
  const testOnly = !deliveryVerified && gencouvBrevoTestRecipients().length > 0;
  let domains = [...new Set(allowed.map(email => email.split("@")[1]))]
    .map(domain => ({ domain, authenticated: false, senders: [] as string[] }));
  let reachable = false;
  let authFailed = false;
  let accountEligible = false;
  let accountCredits: number | null = null;
  if (key) {
    try {
      const get = (path: string) => fetch("https://api.brevo.com/v3" + path, {
        headers: { "api-key": key, Accept: "application/json" },
        cache: "no-store", signal: AbortSignal.timeout(8000),
      });
      const responses = await Promise.all([get("/account"), get("/senders"), get("/senders/domains")]);
      authFailed = responses.some(response => response.status === 401 || response.status === 403);
      if (responses.every(response => response.ok)) {
        const [account, identities, registry] = await Promise.all(responses.map(response => response.json()));
        reachable = Array.isArray(identities.senders) && Array.isArray(registry.domains);
        accountEligible = account.relay?.enabled === true;
        const limits: unknown[] = Array.isArray(account.plan)
          ? account.plan.filter((plan: { creditsType?: unknown }) => plan?.creditsType === "sendLimit")
            .map((plan: { credits?: unknown }) => plan.credits) : [];
        // Multiple balances may overlap. Use the most restrictive reported balance.
        if (limits.length && limits.every(value => typeof value === "number" && Number.isFinite(value) && value >= 0)) {
          accountCredits = Math.floor(Math.min(...limits as number[]));
        }
        if (reachable) {
          const active = new Set(identities.senders.filter((sender: { active?: unknown }) => sender?.active === true)
            .map((sender: { email?: unknown }) => String(sender.email ?? "").trim().toLowerCase()));
          domains = domains.map(({ domain }) => {
            const authenticated = registry.domains.some((entry: { domain_name?: unknown; authenticated?: unknown; verified?: unknown }) =>
              entry?.domain_name === domain && entry.authenticated === true && entry.verified === true);
            return { domain, authenticated, senders: authenticated ? allowed.filter(email => email.endsWith("@" + domain) && active.has(email)) : [] };
          });
        }
      }
    } catch {
      reachable = false;
    }
  }
  const verifiedSenders = domains.flatMap(domain => domain.senders);
  const domainAuthenticated = domains.some(domain => domain.authenticated);
  const remaining = used === null || accountCredits === null ? null : Math.max(0, Math.min(DAILY_TARGET - used, accountCredits - used));
  const note = !key ? "Disconnected" : authFailed ? "Authentication failed" : !reachable ? "Connection unavailable" :
    !domainAuthenticated ? "No approved domain is authenticated" : !verifiedSenders.length ? "Sender unverified" :
    !accountEligible ? "Transactional sending unavailable" : usage.error || !trackingConfigured || (!deliveryVerified && !testOnly) || !(process.env.GENCOUV_UNSUBSCRIBE_SECRET || process.env.ADMIN_SESSION_SECRET) ? "Delivery tracking or unsubscribe configuration unavailable" :
    !activationEnabled ? "Sending disabled" : remaining === null ? "Account capacity unavailable" : remaining === 0 ? "Quota exhausted" : testOnly ? "Controlled test sending only" : "Ready to send";
  return { configured: Boolean(key), reachable, domains, verifiedSenders, domainAuthenticated, schemaReady: !usage.error, activationEnabled,
    deliveryVerified, testOnly, sendingAvailable: note === "Ready to send" || note === "Controlled test sending only", used, resendUsed, dailyLimit: DAILY_TARGET, accountCredits, remaining, note };
}
