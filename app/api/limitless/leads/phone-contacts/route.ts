import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { importProgressiveLeadsInBatches } from "@/lib/bulk-lead-import";
import { getCampaignAudienceLeads, normalizeLeadPhone, type ProgressiveLeadInput } from "@/lib/lead-profile-service";

type PhoneContactInput = { name?: unknown; phone?: unknown; email?: unknown };

function clean(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const scope = await resolveAdminOrganizationScope();
    if (!scope.organizationId || scope.organizationId.startsWith("unavailable:") || scope.status !== "active") {
      return NextResponse.json({ error: "Switch to an active organization before importing contacts." }, { status: 409 });
    }

    const body = await request.json();
    const whatsappConsentConfirmed = body.whatsappConsentConfirmed === true;
    if (!Array.isArray(body.contacts) || body.contacts.length < 1 || body.contacts.length > 500) {
      return NextResponse.json({ error: "Select between 1 and 500 phone contacts per import." }, { status: 400 });
    }

    const existingLeads = await getCampaignAudienceLeads(scope.organizationId, 10000);
    const existingPhones = new Set(existingLeads.map((lead) => normalizeLeadPhone(lead.phone || "")).filter(Boolean));
    const seen = new Set<string>();
    const leads: ProgressiveLeadInput[] = [];
    let skipped = 0;
    const invalid: string[] = [];

    for (let index = 0; index < body.contacts.length; index += 1) {
      const contact = body.contacts[index] as PhoneContactInput;
      const name = clean(contact?.name, 180);
      const phone = normalizeLeadPhone(clean(contact?.phone, 50));
      const email = clean(contact?.email, 240).toLowerCase();

      if (!name || !phone || phone.length < 7 || phone.length > 15) {
        skipped += 1;
        if (invalid.length < 20) invalid.push("Contact " + (index + 1) + " needs a name and a valid phone number.");
        continue;
      }
      if (seen.has(phone) || existingPhones.has(phone)) {
        skipped += 1;
        continue;
      }
      seen.add(phone);
      leads.push({
        name,
        phone,
        email: email || undefined,
        status: "new",
        source: "phone_contacts",
        campaign_eligible: whatsappConsentConfirmed,
        notes: whatsappConsentConfirmed ? "WhatsApp marketing consent confirmed by admin during phone contact import at " + new Date().toISOString() : "Imported from phone contacts. WhatsApp marketing consent not confirmed; campaign eligibility disabled.",
      });
    }

    if (!leads.length) {
      return NextResponse.json({ imported: 0, skipped, errors: invalid, message: "No new contacts with valid phone numbers were found." });
    }

    const result = await importProgressiveLeadsInBatches(scope.organizationId, leads);
    return NextResponse.json({
      imported: result.imported,
      skipped: skipped + result.skipped,
      errors: [...invalid, ...result.errors].slice(0, 30),
      organization: scope.name,
      campaignEligible: whatsappConsentConfirmed,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to import phone contacts." },
      { status: 500 },
    );
  }
}
