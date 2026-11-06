# Reusable Hotel OS tenant setup

Prepared on feat/hotel-tenant-onboarding for review. The new readiness migration is not applied to production. This extends the shared Hotel OS released in PR #337 and its preview fixes; it does not configure a particular hotel.

## One shared experience, independent organizations

Every active organization identified as Hotel, Hotels or Hospitality uses the same hotel routes. Organization identity comes from the validated session. Each hotel supplies its own profile, settings, prices/currency, timezone, room types, physical rooms, published room/service catalog, managers and channel bindings. Nothing copies an existing tenant's settings or seeds example hotel content.

After general onboarding is submitted successfully, hotel tenants are directed to /portal/hotel/setup. Realty, Xposure and other industries keep /portal. The server selects the destination using the saved profile, ignoring caller-supplied organization or industry overrides; the form accepts only these two destinations.

## Required hotel basics and optional channels

The setup screen derives five basic configuration checks: business information, stay policies, escalation contact, active room inventory and published guest information for every active room type. It links incomplete checks to their relevant form section or inventory/catalog page. Progress is a count of configured checks, not a promise of live messaging or an activation action.

WhatsApp connection, agent, template and guest-journey checks are grouped separately. Optional facilities/services do not block hotel basics. No messaging, agent provisioning, campaign enrollment or follow-up dispatch is enabled by this change.

The service-only hotel_tenant_inventory_readiness RPC aggregates the selected tenant's whole inventory without REST row limits. An active physical room makes its type relevant to catalog coverage. Draft/archived entries never satisfy publication coverage. Empty hotels cannot be marked ready, and another hotel's published entries cannot satisfy their checklist.

Inventory and catalog counts require customers.view/manage. Organization settings access alone does not reveal those counts: inaccessible checks remain explicitly unverified. Existing finance, team and integration permissions remain independent. Preview is read-only; multiple managers retain revision checks on settings writes.

## Verification

Two independent synthetic hotels use different identities, policies, timezones, currencies, managers and room types. Tests verify fresh settings stay empty, changes and publication state remain isolated, cross-tenant catalog references fail, RLS hides other settings, anonymous/member callers cannot execute the aggregate, and 1,006 active rooms are counted completely. API tests bind the aggregate to the session organization and keep hidden inventory unverified. Onboarding tests retain Realty/Xposure destinations.

This is the reusable onboarding workstream. Unified guest/inbox profiles, persistent campaign management and manager-configured follow-up enrollment remain separate workstreams. No payment collection, housekeeping or staff-management scope is added. Live WhatsApp testing remains excluded.
