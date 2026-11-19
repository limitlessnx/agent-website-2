# Billing-period visual evidence

Real rendered Next.js pages served only against the local read-only synthetic Supabase fixture. These images contain test organizations, invented usage and no live customer records. They are **not authenticated News acceptance** and are **not approved visual regression baselines**.

`before` captures the new reporting page before the billing-list/metric primitive alignment correction. It is not a claimed capture of the application before the entire Phase 7 feature. `after` captures the corrected shared-component rendering. Both roles were exercised at every width with loaded totals and an injected period-RPC outage; failure remains visible rather than becoming zero consumption. Browser network requests were restricted to the local application, with provider/customer writes blocked by the fixture.

| Width | Admin before | Admin after | Tenant before | Tenant after |
| --- | --- | --- | --- | --- |
| 360px | [Before](before/admin-period-360.png) | [After](after/admin-period-360.png) | [Before](before/tenant-period-360.png) | [After](after/tenant-period-360.png) |
| 430px | [Before](before/admin-period-430.png) | [After](after/admin-period-430.png) | [Before](before/tenant-period-430.png) | [After](after/tenant-period-430.png) |
| 768px | [Before](before/admin-period-768.png) | [After](after/admin-period-768.png) | [Before](before/tenant-period-768.png) | [After](after/tenant-period-768.png) |
| 1024px | [Before](before/admin-period-1024.png) | [After](after/admin-period-1024.png) | [Before](before/tenant-period-1024.png) | [After](after/tenant-period-1024.png) |
| 1440px | [Before](before/admin-period-1440.png) | [After](after/admin-period-1440.png) | [Before](before/tenant-period-1440.png) | [After](after/tenant-period-1440.png) |
| 1920px | [Before](before/admin-period-1920.png) | [After](after/admin-period-1920.png) | [Before](before/tenant-period-1920.png) | [After](after/tenant-period-1920.png) |

Commands: `TMPDIR=/dev/shm/flux-credit-tools/tmp npx playwright test --config playwright.motion.config.ts --grep "billing period totals"`.

The fixture rejects the unrelated proactive monitor's mutation attempts with HTTP 405; those synthetic warnings do not represent production errors or successful monitor writes. Neither billing test clicks an adjustment, upgrade, top-up or reconciliation action.
