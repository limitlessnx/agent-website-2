# Phase 6 release review — 18 November 2026

Scope: reconcile draft #427 with released main `79a50882cc212d2d1f36022b1b7b61a6ef45d760`, review its missing voice prerequisites, tighten raw-payload access and prepare a reviewable release. This is the first communications reliability increment, not completion of every communication channel. No production mutation is authorized or performed by this review.

## Repository and prerequisite findings

Main includes the approved #426 release. #427's earlier green head conflicted in `package.json` and the migration-ledger test. Resolution preserves the released owner-only team controls, industry presets, their tests and all Phase 6 tests. The ledger snapshot incrementally adds only `20261118091000`, whose actual production record was read back; the voice migrations remain pending.

Read-only production metadata confirms:

- Both voice tables and `apply_elevenlabs_voice_receipt` are absent.
- Organizations, agents, conversations, handoffs, wallets and ledger tables exist. Referenced columns, agent tenant key and conversation thread uniqueness match the proposed SQL.
- The existing credit RPC matches the function exercised by the database tests: body MD5 `a43e1354c80b13d48424bd9684f49761`. Its service execution and required dependency-table grants exist.
- There are zero configured ElevenLabs provider-agent mappings. Installing this release does not configure an agent, activate a provider, establish a voice connection or prove provider acceptance.
- The existing security advisor reports unrelated baseline notices: missing-policy information, mutable search path, public extension, executable definer functions and leaked-password protection. This increment does not silently change unrelated security settings. [Advisor remediation index](https://supabase.com/docs/guides/database/database-linter).

Repeatable metadata query: `supabase/release-review/phase6-voice-preflight.sql`. No customer rows, provider secrets or credentials are returned. Read current Supabase changelog/docs before review; current CLI changes do not require a CLI upgrade for the MCP metadata checks used here.

## Exact proposed database scope

1. Existing `20261012090000_phase7_elevenlabs_voice_runtime.sql`: creates call and receipt tables, tenant foreign keys, indexes, RLS and legacy tenant-read policies. It also attempts the named agent composite unique constraint; production already has an equivalent tenant key. No historical migration directory push is permitted.
2. Proposed `20261118163533_elevenlabs_voice_receipt_atomic_recovery.sql`: installs one service-only security-invoker RPC, using existing conversation/handoff/credit services and locks. Replaces browser/default table grants with service-role SELECT/INSERT/UPDATE only. Raw provider payloads remain inaccessible to browser roles even if the legacy membership predicate permits the tenant. No DELETE/TRUNCATE/REFERENCES/TRIGGER access is granted to service_role by this migration.

No memberships, owner assignments, prices, seat limits, plan allowances, customer business records or existing provider configuration are rewritten. The existing credit RPC is reused unchanged. Legitimate future signed receipts can debit the existing wallet once through the atomic boundary; validation must use synthetic wallets only.

SHA256:

| Artifact | SHA256 |
| --- | --- |
| Voice foundation | `14f1dbee1409a2495ab4ab41503a49607fa7217faea0e42c8678d99556518f53` |
| Recovery migration | `91a8559f458242810cce27f5b3a6a81c936aaa59d13085e4e9bb98cbff770dec` |
| Paired review SQL, including final newline | `a22278bd884db9f00c2a9a3b0e876fa1378c17ec500ca23e0847ca0fa2492e7e` |

## Release sequence, approval and rollback

`node scripts/phase6-voice-release-sql.mjs` emits the two existing SQL bodies inside one outer transaction. It does not connect to any database. Only the outer transaction delimiters and introductory comments are removed; function bodies and business SQL are preserved. Test this exact emitted SQL. Do not commit the foundation separately and expose its legacy browser grants before recovery hardening.

After all current-head CI and preview checks pass, request explicit approval for these exact two migrations as a single transaction and the reviewed #427 production release. Recheck main/head, table absence, mappings and dependency hashes immediately before execution. Retain a private pre-change schema/grant/function snapshot. Register only the SQL actually executed, verify canonical history and body hashes, confirm RLS/grants, and run advisors. Do not mark any other pending migration as deployed. Deploy the matching application only after schema verification. No provider activation or configuration change is included in this approval request.

If the paired SQL fails, its transaction rolls back both foundation and recovery. Once receipts exist, preserve call, receipt, conversation, handoff and ledger evidence. Do not roll back to the old non-atomic handler while callbacks are active, replay a backlog automatically, delete receipt tables or refund/debit wallets as an application rollback shortcut. A controlled callback pause/recovery plan needs its own explicit approval if a live integration is later enabled. No automatic provider disconnection is performed.

## Refreshed verification

- Reconciled Maia: 25 test files passed; support: 75 test files passed. These runner totals are files, not estimated nested scenario counts.
- Focused runtime/database/contracts: all three test files passed, including a new real-SQL paired-install scenario. Forced failure after installation rolls back both tables; a subsequent clean install permits service settlement and denies browser raw reads. Original focused coverage was 13 runtime, 10 database and five legacy contract cases; the paired-install case adds one database scenario.
- Real PostgreSQL: all four final concurrency/recovery scenarios passed with the final SQL.
- Changed-file ESLint and migration-ledger checks passed. Whole-repository historical lint debt remains.
- Clean-cache production build, prebuild type check and Next.js TypeScript checks passed. Initial sandbox/cached attempts failed because Turbopack could not bind a local port; the clean build completed with the required local process capabilities. Hosted current-head CI and preview are checked after publication; earlier candidate success is not substituted for those checks.

No UI is changed by this increment; no new screenshots or visual baselines are claimed. Existing responsive suites still run against the reconciled branch. Authenticated Phase 4–5 owner/manager acceptance is awaiting user feedback. Normal public login reachability and invalid-signature rejection cannot prove a working hosted provider connection.

Remaining milestones: authenticated acceptance, real provider acceptance under separate controlled authorization, correlation propagation, channel-state parity and historical/backlog recovery. Unrelated Maia pilot, Leo and Flux Social PRs remain untouched. Production remains on the previously approved Phase 4–5 release during this review.
