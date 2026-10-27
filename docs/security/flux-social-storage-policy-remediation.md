# Flux Social Storage tenant-policy remediation (draft)

## Finding

The live FLUXNIT policy definitions for the four Flux Social members assets policies contain storage.foldername(o.name). The repository's original migration used the unqualified storage.foldername(name) inside a subquery that also references public.organizations o. Because organizations itself has a name column, SQL name resolution can bind name to the inner organization row rather than the outer object path. The live expression confirms this is not merely a formatting difference.

The intended path contract is already implemented in lib/social-assets.ts as:

<organization UUID>/<post UUID or unassigned>/<random ID>-<safe filename>

The remediation migration explicitly uses storage.foldername(storage.objects.name)[1] in every policy, preventing inner-scope name resolution. It preserves the private bucket, membership check, policy names, and all stored objects.

## Scope and guardrails

- Draft migration and static contract tests only.
- No live policy change, migration application, storage mutation, or object access test has been performed.
- No tenant IDs, object names, or file contents were queried.
- Do not treat the static tests as proof of runtime RLS behavior.

## Current environment gate (2026-10-27)

The connected Supabase project currently lists only its `main` branch, and that branch reports `MIGRATIONS_FAILED`. No disposable/non-production branch is available for the required RLS exercise. No branch was created and no migration was applied; creating a Supabase branch may incur cost and requires explicit approval. Runtime RLS validation is therefore blocked until an approved disposable environment is available.

## Required non-production validation before applying

Use two test organizations and authenticated members in a disposable/non-production Supabase project:

1. Member A can list/read/upload/update/delete only objects under A's UUID folder.
2. Member A cannot read/list/upload/update/delete objects under B's UUID folder.
3. A non-member cannot read/list/upload/update/delete either tenant's private assets.
4. Revoking membership immediately denies subsequent authenticated Storage operations.
5. Objects in other buckets retain their current policy behavior.
6. Service-role application uploads and existing signed-URL flows continue to behave as intended.
7. Confirm SQL policy definitions after migration explicitly reference storage.objects.name.

Use synthetic test objects only. Do not use real tenant assets or production credentials for the test.

## Release gate

The migration remains unapplied. It requires successful CI and a non-production RLS integration test before a separate, explicitly approved production migration. This does not authorize organization deletion or any storage cleanup.
