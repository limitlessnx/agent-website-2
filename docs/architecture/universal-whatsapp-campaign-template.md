# Universal WhatsApp campaign baseline

## Default for every organization

The campaign module is shared platform code, not a clone of Xposure or Limitless Realty.
An active organization receives the campaign entry point when the member has the required
conversation/customer permissions. New tenants do not need a slug-specific deployment or a
copy of another organization's configuration.

- Non-hotel tenant portal: the reviewed marketing composer, tenant contact book, phone
  import, consent confirmation, approved marketing template selection, and signed review.
- Hotel tenant portal: the existing guest campaign adapter, with booking, consent and
  manager-handover suppression. Never bypass this adapter through the generic contact route.
- Existing Limitless Realty admin campaign routes keep their property-specific controls.

## Readiness and activation

1. Create the organization and its ordinary member permissions using normal onboarding.
2. Connect that organization's own WhatsApp provider and verify its account. Do not copy a
   phone number, WABA, token, audience, or live mapping from another organization.
3. Discover current provider inventory, including language, category, approval and components.
4. Review the suggested purposes and register the appropriate tenant-specific template
   contracts in `whatsapp_template_configs`. Suggestions are advisory, not authorization.
   A missing, ambiguous, unsupported or unapproved mapping must block the affected send.
5. Import or qualify that tenant's own contacts with documented marketing permission;
   unknown consent and opt-outs remain excluded.
6. Review the exact content, template and audience before sending. A receipt indicates
   provider acceptance, not delivery. Investigate unknown results before retrying.

The shared daily synchronization observes connected Meta tenants and records inventory
gaps. It does not activate templates, create provider templates, or send messages.
Twilio delivery support is retained in the gateway; Meta inventory-backed campaign
readiness is not proof of Twilio campaign compatibility.

## Regression contract

Every new industry, including beauty, retail, real estate, photography and general services,
must inherit the same portal marketing route, tenant isolation and consent checks. Hotel
adapters must retain booking and handover suppression. A legacy direct bulk request must
not bypass the reviewed campaign flow for a non-hotel organization.

Release checklist: verify a fresh tenant, no connected provider, missing template mapping,
approved linked template, opt-out, denied permissions, cross-tenant request, changed
review fingerprint, and missing provider receipt using synthetic recipients. Do not
send real customer campaigns during CI. Keep the existing plan and permission gates.

## Saved starter template pack (v1)

The reusable source of truth is `lib/campaign-starter-templates.ts`. The baseline includes:

| Template | Category | Purpose | Variable order |
|---|---|---|---|
| fluxknight_business_update_v1 | MARKETING | campaign | customer_name, update_details |
| fluxknight_business_offer_v1 | MARKETING | campaign_promotion | customer_name, offer_details |
| fluxknight_guest_offer_v1 | MARKETING | hotel_campaign | customer_name, offer_details |

An authorized integration manager can submit missing drafts from Campaigns, then use Check approval and link. The setup route uses the signed tenant session, exact saved name, language, category and body, and inserts an active mapping only after live approval. Existing active, paused and disabled mappings are preserved. A fresh provider approval is required for every WABA; a saved definition is not an approval. No customer send is triggered by setup. These defaults do not replace dedicated utility or authentication templates.
