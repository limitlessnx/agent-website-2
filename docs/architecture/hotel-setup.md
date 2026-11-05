# Hotel setup and manager access

Prepared on the Phase 2 review branch. No production code, settings or memberships were changed. The new migration is pending.

## Business and hotel policies

Hotel setup lives at /portal/hotel/setup, linked from hotel navigation and shared Settings. Existing Hotel, Hotels and Hospitality industry values resolve to the same hotel navigation; other industries retain their existing routes.

Readers need an active hotel session and organization/customer-view permission. Editing requires organization.manage; trusted admin previews are read-only. Integration inspection and verification have separate integrations.view/manage checks. Team links require member-view/manage access.

The form edits hotel name, public contact details, address, country, IANA timezone, default currency, local check-in/out times, cancellation/refund policy, general inclusions, guest rules and private escalation contacts. Unknown policies remain blank rather than using invented defaults. Saving publishes guest-facing facts immediately. Contact details alone do not configure notification delivery; the existing handoff-assignment settings remain authoritative.

The service-only hotel_save_settings RPC validates a fixed set of fields, serializes each tenant, compares the expected revision and atomically stores settings, an actor/revision history snapshot and shared onboarding profile changes. Updating timezone therefore also updates the Overview and workspace date source. New room-type and service forms use the default currency; existing room rates and reservation quotes retain their saved currencies. Stale edits fail without overwriting another manager. API tenant and actor come only from the live session.

The published Catalog/agent projection retrieves saved hotel policies fresh, including when there are no matching catalog entries. It explicitly selects guest-safe fields and excludes all escalation details and unexpected configuration. Policy text is data, never authority to override agent instructions. The guest information preview shows the same facts. No booking, payment or automated outbound messaging behavior is enabled by saving settings.

## Readiness and WhatsApp configuration

The setup checklist links existing Team & Access, WhatsApp onboarding in Integrations, Catalog, agent configuration and handoff settings. It shows missing policies, active WhatsApp agent count and recorded provider-approved hotel templates. A matching template purpose, language and variables are still validated at send time; a positive template count does not authorize every campaign.

Provider readiness is based on the existing connection health and a saved check within 24 hours. Missing/stale checks remain unverified. An integrations manager can explicitly recheck through the existing provider-readiness implementation; no credentials are returned. The checklist never claims successful live message delivery. Verification refreshes the checklist without discarding unsaved form input.

The user declined a live WhatsApp test. Read-only inspection of the authorized Newt Enterprise workspace found no WhatsApp integration, sender binding or provisioned agent. No messages were sent and no live resources were provisioned.

## Manager access

The existing organization Access ID creates a pending request, not membership. Approval/rejection still use the existing transaction-safe RPCs and owner/admin checks. The team API now additionally scopes pending request IDs to the currently selected organization before invoking either RPC. Manager removal prevents reentry; existing signed dashboard cookies are also rejected because each request revalidates active membership.

Runtime regressions cover request, approval, entry, removal, existing-cookie revocation and foreign-organization rejection. Settings regressions cover authorization, preview behavior, tenant/actor binding, stale writes, malformed input, RLS and private-contact projection. PostgreSQL CI checks simultaneous settings writers in addition to room allocation and reference allocation.

## Review and release

Browser smoke tests used the real production form in a local synthetic-data harness with mocked transport: save, conflict preservation, reload, provider attention state, read-only controls and a 390px layout without horizontal overflow. This is not a live database or WhatsApp test.

The approved Phase 2 release would need only these explicitly reviewed pending migrations, in order: 20261105064158, 20261105085441, 20261105121746, 20261105125822, 20261105134815. Do not apply unrelated pending migrations. Merge, production migration/storage creation and deployment remain separate approval steps.
