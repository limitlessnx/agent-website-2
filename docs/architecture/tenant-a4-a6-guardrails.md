# Fluxknight Tenant Architecture: A4-A6 Guardrails

## A4: tenant data isolation

The organization ID is the hard tenant boundary.

- Tenant-facing CRM, conversations, follow-ups, handoffs, systems, and entitlements are protected by RLS and role permissions.
- Internal runtime tables are service-role only. RLS remains enabled as defense in depth.
- Agent runtime parent relationships use composite organization-aware foreign keys.
- Privileged provisioning and runtime RPCs are not executable by anon or authenticated roles.
- Service-role code must still supply explicit organization predicates. Service role is not treated as a tenant identity.

## A5: packages and entitlements

The new service-package model is authoritative for modular Fluxknight systems.

Resolution order:

1. Organization-specific entitlement override.
2. Active organization service package.
3. Package entitlement and system rules.
4. Fail closed when no package or explicit entitlement exists.

Baseline package limits:

- Starter: 3 team seats, 3 active systems.
- Growth: 3 team seats, 6 active systems.
- Enterprise: 3 team seats, unlimited active systems.

Seat and system limits are backend-enforced configuration, not UI decoration.

`service_package_systems` becomes an allowlist when at least one system is configured for a package. Until then, available catalog systems are permitted subject to the package system-count limit.

Legacy billing-plan entitlements remain separate and are not the authority for the new modular tenant model.

## A6: modular system lifecycle

Package / entitlement → System request → Included agent bindings → Agent provisioning → Workflow provisioning → Testing → Activation.

Provisioning must never automatically activate external workflows.

System state: `setup_required → provisioning → testing → active`. Failures move the system to `needs_attention`.

Activation requires the system to remain entitled, the organization to remain within its allowance, required automations to exist, readiness tests to pass, and external workflows to activate successfully.

Requests and provisioning are idempotent. Duplicate requests return the existing installation instead of creating a second one.

## Super Admin rule

Super Admin can assign packages, request systems, provision, test, and activate systems, but does not bypass package or entitlement rules. Exceptions are represented explicitly through a package or organization entitlement.

## Tenant Super Leo implication

Tenant Super Leo may diagnose system state and surface failures, but future remediation actions must use the same permission and entitlement gates. Critical or platform-level failures escalate to Super Admin support with tenant, system, and runtime context attached.
