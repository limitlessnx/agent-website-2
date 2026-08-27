import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export type PublicLeoLeadProfile = {
  name: string;
  email: string;
  phone: string;
  organization: string;
  business_type?: string;
  main_goal?: string;
  current_tools?: string;
  lead_volume?: string;
  timeline?: string;
  budget?: string;
  preferred_contact_time?: string;
};

function clean(value: unknown, max = 180) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

export async function capturePublicLeoLead(args: Record<string, unknown>) {
  const name = clean(args.name);
  const email = clean(args.email, 240).toLowerCase();
  const phone = clean(args.phone, 80);
  const organization = clean(args.organization || args.business_name);
  if (!name || !email || !phone || !organization) return { ok: false, status: "missing_details", error: "Name, email, phone and organization are required before capturing the lead." } as const;
  if (!validEmail(email)) return { ok: false, status: "invalid_email", error: "The email address is not valid." } as const;

  const now = new Date().toISOString();
  const rows = await supabaseServerRequest<Array<{ id: string }>>("evaluation_leads", {
    method: "POST",
    body: JSON.stringify({
      name, email, phone, business_name: organization,
      business_type: clean(args.business_type) || "Not specified",
      agent_types: Array.isArray(args.agent_types) ? args.agent_types : [],
      main_goal: clean(args.main_goal, 500) || "Public Leo consultation",
      current_tools: clean(args.current_tools, 500) || null,
      lead_volume: clean(args.lead_volume, 120) || null,
      timeline: clean(args.timeline, 120) || null,
      budget: clean(args.budget, 120) || null,
      preferred_contact_time: clean(args.preferred_contact_time, 120) || null,
      consent_given: false, source: "public_leo", status: "new", submitted_at: now,
    }),
  });
  return { ok: true, status: "captured", leadId: rows[0]?.id || null, capturedAt: now } as const;
}
