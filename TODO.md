# Fluxknight real estate — master implementation checklist

Baseline: `b123b9c74109c34ebd01d60e668d916cedb5e22c`, 24 October 2026. Work is on a separate repair branch, not main.

## Phase status

| Phase | Status | Production status |
|---|---|---|
| 0 Audit | Implemented: scoped baseline; live n8n/Trigger execution audit blocked by access | Read-only checks only |
| 1 Maia and handover | Idempotency, truthful acknowledgements, tenant-bound receipts, approved 131047 template fallback and two-step exact-preview staff retry implemented/tested locally | Migrations unapplied; live notification/callback/e2e open |
| 2 Leo security | Implemented locally; approval/replay, second-tenant and legacy inspection one-time approval tests pass | Not deployed or production verified |
| 3 CRM/calendar/follow-ups/campaigns | Calendar confirmation, opt-in reminders, CRM-only audiences, exact campaign approvals, tenant-bound receipts and atomic inspection audits implemented/tested locally | Migrations unapplied; external scheduler/provider, stage/follow-up and full campaign e2e remain |
| 4 Property estate assignment | Implemented locally; tenant relation and atomic audit tests pass | Migration unapplied; not production verified |
| 5 Estate catalog | Implemented locally; catalog/FAQ/order/knowledge writes and audit records share transactions; Maia retrieval locally tested | Migrations unapplied; no live Maia retrieval check |
| 6 Tenant readiness | Real-estate-first workspace setup, verification/payment context recovery, invitation guard and retry-safe tenant provisioning tested locally | Narrow `workspace_provisioning_acl` migration applied to FLUXNIT on 2026-10-24 and read-back verified: anon/authenticated denied, service_role allowed for workspace/trial provisioning. Retry-safe provisioning remains unapplied; staging review found missing core prerequisites and an unresolved readiness-table mismatch. |
| 7 n8n cleanup | Blocked: no live credentials/dependency verification | Nothing retired |
| 8 Dashboard | Partially implemented; estate/operations/inspection/approval cards, handoff queue, exact retry preview and safe status labels added | Isolated Vercel Preview is READY on `0af7682`; no browser/device or backend E2E review because staging has no app schema |
| 9 Release acceptance | Local tenant-neutral real-estate suite passes 181/181 after migration filename re-sequencing. Four new preflight contract tests compare the 42-table/60-policy inventory to the comment-only metadata preview and enforce catalog-only bounded SQL. ESLint is 0 errors/0 warnings across 77 changed safe sources; full Vercel Preview TypeScript/build succeeded and generated 217 static pages. Local sparse TypeScript has one missing out-of-scope component import and zero in-scope diagnostics. Maia direct booking is blocked for real-estate tenants pending operator confirmation; non-real-estate validation remains enabled. | The seven named shared reminder/provisioning migrations and 14 local app migrations are absent from FLUXNIT/staging; all 21 branch filenames now sort after the applied ACL version `20261024140349` as `20261024140400`–`20261024142400`, with SQL bodies unchanged. [STAGING_BASELINE_PREFLIGHT.sql](STAGING_BASELINE_PREFLIGHT.sql) is a read-only verifier, not a schema baseline and not run against Supabase. Staging remains ACL-smoke-only; the 42-table/60-policy DDL is comment-only and incomplete. Branch-scoped Preview overrides use staging and inert providers; service-key aliases use staging anon only. PR #281 is open; current code head `a0ea24d` passed tenant-neutral safe check `40217496426`, broad Maia/dashboard checks are skipped for this exact branch, and its Vercel Preview was BUILDING at last read. |

Current evidence and residual blockers are maintained in [REAL_ESTATE_REVIEW.md](REAL_ESTATE_REVIEW.md), [MAIN_INTEGRATION_REVIEW.md](MAIN_INTEGRATION_REVIEW.md), [STAGING_BASELINE_REVIEW.md](STAGING_BASELINE_REVIEW.md), the non-executable [STAGING_BASELINE_MANIFEST.md](STAGING_BASELINE_MANIFEST.md) and the [comment-only DDL preview](STAGING_BASELINE_DDL_PREVIEW.sql). The same-organization staging project (`rwewcnftxnaynpotbsms`, $0/month quote) contains only non-functional provisioning stubs and ACL smoke migrations—no app schema, tenant or customer data. The narrow FLUXNIT ACL migration is the only production database change from this work. PR #281 is open; no merge or Production code deployment has occurred. The PR #280 workflow scope incident is documented, and branch-specific guards plus a dedicated tenant-neutral PR check are in place; the current tip still needs its safe check and isolated Preview confirmed. The shared main deployment remains live, while the reminder schema is absent from both checked Supabase projects. A complete staging schema, least-privilege staging server key, and E2E acceptance remain required before production merge.

## Authoritative outcome criteria

The complete user-provided criteria below are preserved verbatim, except formatting. A phase remains open until its relevant criteria have verified evidence.

FLUXKNIGHT REAL ESTATE PLATFORM

Multi-Tenant Implementation, System Repair, Estate Catalog, Leo AI, and Production Verification

1. Mission

Act as the lead software engineer, systems architect, backend engineer, QA engineer, and deployment operator for the existing Fluxknight real estate platform.

Your responsibility is to diagnose, implement, test, deploy, and verify the outstanding work. Do not stop at producing recommendations or a diagnosis report.

The platform is a multi-tenant real estate SaaS system designed to serve multiple independent real estate organizations. Limitless Realty is one operational tenant, not the owner or template for all platform behavior.

All new and modified features must be reusable across tenants, enforce organization-level data isolation, and respect the existing authorization, subscription, provisioning, and Flux Credits architecture.

Scope

Implement and verify:

1. Limitless Realty’s Maia WhatsApp integration and human handover.
2. Leo’s Super Admin and dashboard execution capabilities.
3. CRM stages, inspections, follow-up activation, and campaign execution.
4. The General Property Catalog and a reusable Estate Catalog.
5. Property-to-estate assignment from the existing property editor.
6. Estate creation, images, FAQs, payment terms, and operating instructions.
7. Tenant onboarding, configuration, permissions, entitlements, and isolation.
8. Safe cleanup of obsolete n8n resources.
9. Dashboard usability, responsive layouts, testing, deployment, and production verification.

Explicit exclusion: Xposure is out of scope. Its handover fix is believed to have been completed and is being handled separately in another project folder. Do not inspect, modify, test, redeploy, reconfigure, or otherwise touch Xposure’s code, tenant configuration, WhatsApp integrations, workflows, or database records.

⸻

PHASE 0: AUDIT THE EXISTING PLATFORM

Known starting points:

* GitHub repository: limitlessnx/agent-website-2
* Primary branch: main
* Vercel project: limitlessnx-agent-website-2
* Supabase project reference: tacxegmlppngnuvldojy

Verify the current repository, project, deployment, and permissions before relying on these identifiers.

Previously identified Limitless Realty references:

* Organization ID: b15f21b4-5697-4d21-9421-8a34eae3476d
* Agent ID: 3d81f64b-11e7-445a-96fc-5443df1674fa
* WhatsApp number: +234 911 159 9935
* Meta phone number ID: 1252450784610831

Verify these values against current records before use.

Tasks

1. Inspect the repository, branch, latest commits, uncommitted work, open pull requests, and current deployment.
2. Inspect Supabase tables, relationships, row-level security policies, database functions, migrations, and relevant tenant records.
3. Review existing property and estate functionality, dashboard components, tenant provisioning, authentication, permissions, and Flux Credits metering.
4. Audit Maia’s inbound processing, human handover, integrations, and runtime errors.
5. Audit Leo’s tool registry, approval logic, production executors, CRM operations, follow-up scheduler, and campaign execution.
6. Inventory n8n workflows, webhook routes, scheduled triggers, execution histories, credential references, and application dependencies.
7. Identify confirmed defects, root causes, implementation dependencies, and regression risks.

Earlier investigations reported:

* Intermittent inbound failures with Plus is required for this feature.
* Possible tenant-ID mismatches between property creation and catalog retrieval.
* A property that existed in the catalog but was not retrieved correctly by Maia.
* A follow-up preparation action that created a draft without activating a real schedule.
* Potential gaps in binding Leo confirmations to exact actions and arguments.
* Campaign execution statuses that may not reflect actual delivery outcomes.

Treat these as investigation leads, not confirmed current defects.

Deliverable: A concise baseline report with evidence, root causes, files and database objects involved, and an implementation plan.

Preserve unrelated changes and existing functionality. Do not reset branches, delete data, or modify production schemas before understanding the current system.

⸻

PHASE 1: REPAIR LIMITLESS REALTY MAIA AND HUMAN HANDOVER

Investigate Limitless Realty only.

Tasks

1. Verify the current WhatsApp integration health, phone ID, organization mapping, agent configuration, and handover destination.
2. Trace the inbound message from webhook reception through tenant resolution, conversation processing, response generation, and outbound delivery.
3. Diagnose the source of Plus is required for this feature. and correct the underlying issue without bypassing legitimate permissions or subscription requirements.
4. Verify the authoritative Limitless Realty handover route, workflow, templates, and recipient configuration.
5. Trace handover decisions through recipient resolution, message submission, provider acknowledgement, and persisted handover status.
6. Ensure the human agent receives sufficient conversation context.
7. Prevent duplicate messages caused by webhook retries or repeated execution.
8. Record failed handovers accurately and support safe retries.
9. Verify Maia can retrieve existing Limitless Realty listings and associated images.
10. Ensure the dashboard reflects actual integration health and handover status.

Acceptance criteria

* Inbound messages are processed reliably.
* Maia uses the correct tenant’s property data.
* Human handover reaches the verified Limitless Realty recipient.
* Delivery and handover status are accurately persisted.
* Failed delivery is visible and never falsely reported as successful.
* Cross-tenant access and duplicate-processing tests pass.

Use controlled test conversations and authorized recipients. Do not send unsolicited messages to clients.

⸻

PHASE 2: SECURE LEO’S AUTHORIZATION AND CONFIRMATION SYSTEM

Leo must perform its intended operations while respecting permissions and explicit confirmation requirements.

Inspect the current implementation before changing it. Previously identified files include:

* lib/leo-core.ts
* lib/leo-tool-runtime.ts
* lib/ai-runtime/production-executors.ts
* lib/ai-runtime/tool-registry.ts
* app/api/leo/tool/route.ts
* app/api/internal/leo/execute/route.ts
* lib/leo-limitless-messaging.ts

Verify their current paths and behavior.

Confirmation requirements

Every consequential action must require a confirmation bound to:

* Authenticated user.
* Organization and tenant context.
* Exact tool and action.
* Exact action arguments.
* Expiry.
* Unique approval or execution identifier.

Reject expired, mismatched, reused, or replayed confirmations.

Do not trust a caller-supplied confirmed: true flag without verifying trusted server-side approval state or an equivalent secure mechanism.

Apply these controls consistently to chat/API execution, voice execution, and internal execution routes.

Require appropriate explicit confirmation for:

* Sending campaigns or follow-up messages.
* CRM stage changes.
* Follow-up activation or schedule modifications.
* Appointment management.
* Agent pause and resume.
* Other consequential production actions.

Read-only actions should not require unnecessary confirmation.

Audit logging

Record the action, requesting user, organization, approval status, execution outcome, affected resource identifiers, and relevant failure details.

Never log credentials, tokens, or unnecessary customer information.

Acceptance criteria

Unauthorized actions are rejected, valid approvals authorize only the intended operation, approvals cannot be reused, tenant boundaries are preserved, and audit logs reflect actual outcomes.

⸻

PHASE 3: COMPLETE CRM, INSPECTIONS, FOLLOW-UPS, AND CAMPAIGNS

3A. CRM and inspection stages

1. Inspect the existing CRM stages, inspection records, and permitted transitions.
2. Implement the correct transition from inspection to the appropriate follow-up stage.
3. Validate the client, organization, inspection outcome, and required fields.
4. Update the canonical CRM record and persist audit history.
5. Reflect the updated state in the dashboard.
6. Reject invalid transitions with clear error messages.

Do not invent stage names or bypass existing business rules.

3B. Real follow-up activation

A draft task is not an active follow-up.

Implement or repair the actual activation operation so it:

* Validates the client, contact details, and organization.
* Uses the correct communication channel.
* Validates schedule and timezone rules.
* Respects opt-outs and contact policies.
* Persists an active schedule or queues it through the authoritative scheduling mechanism.
* Records next execution time and status.
* Prevents duplicate activation.
* Updates the dashboard accurately.
* Handles client replies, cancellations, failures, and retries correctly.

Verify existing follow-up sequences and stopping rules against the current implementation rather than assuming historical settings are still correct.

3C. Campaign execution

1. Separate campaign preparation, approval, execution, and delivery reconciliation.
2. Validate the audience and preview eligible recipient counts and exclusions.
3. Enforce opt-outs, suppression lists, cooldowns, and tenant boundaries.
4. Require valid explicit confirmation before sending.
5. Implement or verify campaign and recipient-level idempotency.
6. Record provider message IDs and delivery callbacks where available.
7. Reconcile sent, delivered, failed, and unknown outcomes.
8. Handle partial failures and safe retries.
9. Ensure a successful API response is not automatically treated as confirmed delivery.

Use a controlled test audience. Do not send a broad campaign to real clients merely to test execution.

Acceptance criteria

Leo can move a test client through the correct CRM workflow, activate a real scheduled follow-up, and execute an approved test campaign with accurate delivery reporting.

⸻

PHASE 4: EXTEND THE GENERAL PROPERTY CATALOG WITH ESTATE ASSIGNMENT

The existing Property Catalog remains the canonical source for property listings.

Do not create duplicate property records or replace the existing catalog with a disconnected implementation.

Property editor requirements

Add an Estate / Assign to Estate control to the existing property-editing interface.

Authorized users must be able to:

1. View estates belonging to their organization.
2. Assign an existing property to an estate.
3. Change or remove the association where permitted.
4. Save the association and see it when reopening the property.
5. Navigate between the property and its assigned estate.
6. See a shortcut to create an estate if none exists.
7. Preserve all existing property fields, images, pricing, ownership, and status.
8. Receive clear validation errors.

Validate that the property and estate belong to the same organization.

Data model

Inspect the existing schema before making changes.

Use a proper relational relationship with explicit organization ownership and suitable database constraints. A nullable estate reference on the canonical property record may be sufficient; use a relationship table only if the current model requires it.

Do not duplicate listings, introduce redundant sources of truth, or bypass existing tenant authorization.

Acceptance criteria

An existing property can be assigned to an estate, saved, reopened, shown in that estate’s inventory, and retrieved by Maia without creating a duplicate listing.

⸻

PHASE 5: IMPLEMENT A REUSABLE ESTATE CATALOG

Add a visible Estate Catalog card to the existing organization dashboard.

The card must allow authorized users to:

* View estates.
* Create new estates.
* Open and edit existing estates.
* View linked properties and units.
* Manage estate images, FAQs, payment terms, and operating instructions.

Use the existing dashboard design and responsive patterns.

5A. Estate creation and editing

Support the following fields where appropriate.

Estate profile

* Estate name.
* Description.
* Location and address.
* Organization ownership.
* Contact information.
* Status.
* Other useful estate metadata.

Estate images

* Upload and preview a cover image.
* Replace or remove the image where permitted.
* Use the existing secure media storage architecture.
* Enforce tenant-scoped upload and retrieval.

Estate FAQs

Provide a dedicated interface to create, edit, reorder, and delete FAQs.

Each FAQ should contain a question and answer, with optional categorization.

FAQs must belong to the correct estate and organization and be available to Maia’s retrieval system.

Mode of Operation / Sales Instructions

Provide a dedicated editor for the estate’s Mode of Operation / Sales Instructions.

It must support detailed business guidance, including:

* Enquiry and sales procedures.
* Approved payment channels and payment procedures.
* Purchase requirements.
* Inspection and viewing procedures.
* Booking and allocation processes.
* Documentation requirements.
* Installment terms where applicable.
* Estate rules and restrictions.
* Approved responses to common questions.
* Escalation procedures for enquiries requiring human support.

This content must guide Maia’s responses about the relevant estate. It must not merely be displayed as an administrative note.

Treat stored instructions as business knowledge subject to system-level safety rules, authorization, and approved execution logic. Arbitrary text must not become unrestricted executable instructions.

Additional estate information

Support relevant payment terms, installment plans, operating procedures, and knowledge documents where these are not already stored canonically elsewhere.

5B. Estate details page

Provide clear sections for:

1. Overview.
2. Images.
3. FAQs.
4. Mode of Operation / Sales Instructions.
5. Payment terms and procedures.
6. Linked properties and units.
7. Knowledge documents.

Show the actual linked-property count and provide navigation to the associated records.

5C. Connect estate information to Maia

For a property associated with an estate, Maia must retrieve relevant information from:

* The canonical property listing.
* The assigned estate profile.
* Estate FAQs.
* Approved operating and sales instructions.
* Applicable payment terms and procedures.

Use the existing retrieval architecture. Do not hardcode estate-specific answers into source code.

Updates to estate content should become available through the existing knowledge retrieval mechanism without requiring a code deployment.

When information is missing or contradictory, Maia must not invent policies or payment terms. It should clarify the limitation or escalate to an authorized human agent.

Acceptance criteria

An authorized user can create an estate, upload its image, add FAQs and operating instructions, link existing properties, and verify that Maia retrieves the correct information.

⸻

PHASE 6: MAKE THE PLATFORM TENANT-READY

Every feature must work for multiple independent real estate organizations.

Limitless Realty is the first operational tenant, not the default owner of shared platform behavior.

6A. Tenant isolation

Ensure organization ownership and authorization are enforced for:

* Properties and estates.
* Images and uploaded documents.
* FAQs and knowledge retrieval.
* Leads, clients, inspections, and conversations.
* Maia and tenant Leo configurations.
* Follow-ups, campaigns, and message histories.
* Human handovers and destinations.
* WhatsApp integrations, credentials references, and webhooks.
* Flux Credits, usage and billing-related records.
* Audit logs and operational configuration.

Enforce tenant isolation in backend authorization and database security policies, not merely in frontend filters.

6B. Tenant onboarding and provisioning

Audit the existing onboarding architecture and extend it where needed.

A new organization should be able to:

1. Register or be created by an authorized administrator.
2. Establish organization membership and roles.
3. Initialize its workspace and configuration.
4. Set up its property and estate catalogs.
5. Configure its Maia agent and approved business knowledge.
6. Connect its WhatsApp number and handover destination.
7. Configure lead stages and follow-up workflows.
8. View package entitlements and usage.
9. See a readiness checklist showing which integrations and features are configured and operational.

Provisioning must be idempotent and safe to retry.

Do not create duplicate organizations, agents, workflows, or configuration records during repeated setup attempts.

Do not mark an agent as ready solely because a configuration record exists. Verify required integrations and readiness conditions.

6C. Tenant-specific agents and configuration

Each organization must have its own:

* Maia configuration and knowledge.
* Property and estate inventory.
* FAQs and operating rules.
* WhatsApp integration and handover destination.
* CRM data and workflow configuration.
* User roles and permissions.
* Usage and entitlements.
* Relevant branding and contact information.

Use shared code and infrastructure where appropriate, but never share tenant data or configuration accidentally.

6D. Super Admin versus tenant operations

Preserve the distinction between platform-level administration and tenant-level operations.

Super Admin Leo may perform authorized platform-wide administration and support operations, with appropriate access controls and audit records.

Tenant Leo must operate within its own organization’s data, permissions, entitlements, and integrations.

Platform-wide access must never become an excuse to bypass authorization or omit audit records.

6E. Business workflow configuration

Avoid hardcoding Limitless Realty’s workflow into the platform.

Where the current architecture supports it, allow tenants to configure:

* Lead stages and transitions.
* Inspection procedures.
* Follow-up schedules and stopping rules.
* Human-handover rules and recipients.
* Estate-specific payment and sales processes.
* Maia’s business knowledge and escalation behavior.

Use a shared workflow engine with validated tenant-specific configuration.

6F. Packages and Flux Credits

Preserve and extend the existing Flux Credits architecture.

Verify that the relationship between package entitlements, usage allowances, tenant wallets, metered operations, immutable ledger records, usage limits, and reporting remains consistent.

Do not create a parallel credit counter or rebuild existing metering unnecessarily.

Ensure tenant isolation, correct deductions, exhaustion behavior, and authorized top-ups or adjustments.

Acceptance criteria

A second independent test tenant can be provisioned and operate with its own properties, estates, FAQs, Maia configuration, users, integrations and usage records without inheriting Limitless Realty’s data or configuration.

⸻

PHASE 7: AUDIT AND CLEAN UP OBSOLETE N8N RESOURCES

Reduce unnecessary resource usage and operational clutter without breaking required workflows.

7A. Inventory and dependency analysis

Inventory:

* Active and inactive workflows.
* Webhook endpoints.
* Scheduled triggers and jobs.
* Workflow execution histories.
* Credential references.
* Application routes calling n8n.
* Database records or functions used by workflows.
* Duplicate or superseded workflows.
* Failed or orphaned executions.
* Workflows used by Maia, Leo, campaigns, follow-ups, integrations, or handovers.

Classify each resource as:

1. Required and active.
2. Required but currently failing or disabled.
3. Obsolete and safe to retire.
4. Uncertain and requiring further verification.

Search source code, environment configuration and integration records for references before deciding what to remove.

7B. Safe retirement

For resources confirmed to be obsolete:

1. Record their names, IDs, dependencies and reason for retirement.
2. Export or back up workflow definitions where supported.
3. Verify that no current production route, scheduled job or integration depends on them.
4. Disable obsolete triggers or workflows before deletion where appropriate.
5. Remove confirmed obsolete resources and references.
6. Remove execution-history data only where permitted and safe.
7. Verify actual storage usage and identify its source.
8. Re-test affected integration paths.
9. Document removed resources and restoration steps.

Do not delete resources simply because they are old or inactive. Do not delete active credentials, production webhooks, required workflows, or records that must be retained.

Do not assume workflow deletion will free significant storage. Determine whether storage is consumed by execution history, databases, logs, media, or another source.

If permissions are missing, report the exact blocker and continue with independent work. Never claim a deletion occurred without verifying it.

Acceptance criteria

Obsolete resources are identified and safely retired, required workflows continue working, and storage cleanup is supported by evidence.

⸻

PHASE 8: COMPLETE THE DASHBOARD

Preserve existing functionality while exposing the repaired and new capabilities.

Relevant dashboard areas should include:

* Financial Overview.
* General Property Catalog.
* Estate Catalog.
* Leads and Inspections.
* Human Handover.
* Maia Activity.
* Leo Activity and Approvals.
* Follow-ups and Campaigns.
* Existing collection and operational modules.

Required behavior

* The Estate Catalog card is visible and functional.
* The property editor supports estate assignment.
* Estate details expose images, FAQs, operating instructions, and linked properties.
* Leo actions clearly display confirmation requirements and execution results.
* Follow-up screens distinguish draft, active, scheduled, sent, delivered, and failed states where supported.
* Campaign screens reflect actual execution and delivery results.
* Human handovers display pending, completed, and failed outcomes.
* Counts and statuses come from real backend records.
* Tenant-specific branding and configuration are respected.
* Mobile and desktop layouts are tested.
* Backend authorization remains authoritative.

Acceptance criteria

Authorized operators can manage estates, link properties, monitor workflows and investigate failures through the dashboard without direct database access.

⸻

PHASE 9: TESTING, DEPLOYMENT, AND PRODUCTION ACCEPTANCE

Automated tests

Add or update tests covering:

* Limitless Realty inbound processing and handover.
* Tenant isolation and database authorization.
* Leo confirmation matching, expiry and one-time use.
* CRM stage transitions.
* Follow-up activation, scheduling and idempotency.
* Campaign eligibility, suppression and delivery reconciliation.
* Property-to-estate assignment.
* Estate creation and editing.
* Estate FAQ and operating-instruction persistence.
* Maia’s estate and property retrieval.
* Tenant provisioning and idempotency.
* Flux Credits isolation and metering.
* n8n dependency integrity after cleanup.
* Correct failure and success reporting.

Review existing tests and supplement source-pattern checks with behavioral integration tests where needed.

End-to-end acceptance scenarios

Demonstrate:

1. Limitless Realty inbound message → Maia response → correct property retrieval.
2. Limitless Realty conversation → human handover → correct recipient → persisted result.
3. Leo confirmation → authorized CRM stage update.
4. Inspection completion → follow-up activation → scheduler recognition.
5. Controlled campaign → valid approval → send → delivery reconciliation.
6. Existing property → estate assignment → correct estate inventory.
7. Estate creation → image, FAQs and operating instructions saved.
8. Maia retrieves the correct estate-specific information.
9. Unauthorized cross-tenant property or estate access is rejected.
10. A second tenant is provisioned without inheriting Limitless Realty’s data.
11. Tenant usage and Flux Credits remain isolated.
12. Obsolete n8n resources are retired without breaking required integrations.
13. Dashboard status matches actual backend records.

Do not use real client campaigns as test fixtures. Use controlled test records and authorized recipients.

Release procedure

1. Review all code changes and migrations.
2. Run the project’s existing lint, type-check, test and production-build commands.
3. Fix regressions before merging.
4. Commit changes in logical, reviewable groups.
5. Deploy using the existing deployment process.
6. Confirm the intended commit is live.
7. Inspect production runtime logs and audit records.
8. Perform controlled production acceptance tests.
9. Verify rollback and recovery procedures.
10. Document the final production state and outstanding issues.

Do not bypass security protections, expose secrets, or claim deployment success without evidence.

⸻

10. IMPLEMENTATION ORDER

Execute in this order:

1. Phase 0: Baseline and system audit.
2. Phase 1: Limitless Realty Maia and handover.
3. Phase 2: Leo confirmation and permission security.
4. Phase 3: CRM, inspections, follow-ups and campaigns.
5. Phase 4: Existing property-to-estate assignment.
6. Phase 5: Estate Catalog card and estate management.
7. Phase 6: Multi-tenant architecture, onboarding, permissions, entitlements and Flux Credits.
8. Phase 7: Safe n8n cleanup.
9. Phase 8: Dashboard integration and responsive verification.
10. Phase 9: Regression testing, deployment and production acceptance.

Coordinate shared files and database migrations. Independent diagnostics may run in parallel where safe.

Prioritize critical production failures without allowing unrelated unfinished work to delay an isolated, verified repair.

⸻

11. REPORTING REQUIREMENTS

Maintain a single master implementation checklist.

At the end of each phase, report:

* Phase status: Not started, In progress, Blocked, Implemented, Tested, Deployed or Production verified.
* Confirmed findings and root causes.
* Files, APIs, tables, workflows and migrations changed.
* Tests executed and their actual results.
* Deployment and production impact.
* n8n resources retired and supporting evidence.
* Outstanding blockers and risks.
* The next concrete implementation task.

Do not mark a phase complete merely because code was written or a build passed. Distinguish implementation, automated testing, deployment, and production verification.

⸻

12. DEFINITION OF DONE

The project is complete when:

* Limitless Realty Maia processes messages reliably and hands conversations to the correct human agent.
* Leo executes authorized dashboard actions with secure explicit confirmations.
* CRM transitions and follow-up activation are real, persisted and verifiable.
* Campaigns are idempotent and delivery outcomes are accurately reported.
* Existing properties can be assigned to estates.
* The Estate Catalog card and estate management workflow are functional.
* Estate images, FAQs, payment terms and operating instructions persist and guide Maia’s responses.
* The platform supports multiple independent tenants without cross-tenant leakage.
* Tenant onboarding and provisioning are repeatable and idempotent.
* Tenant-specific agents, integrations, workflows, permissions and Flux Credits remain isolated.
* Obsolete n8n resources are removed only after dependency verification.
* Dashboard features work on mobile and desktop.
* Automated and end-to-end tests pass.
* The intended changes are deployed and production behavior is verified.
* Recovery steps and remaining limitations are documented honestly.

IMMEDIATE INSTRUCTION

Begin with Phase 0. Verify the current repository, deployment, database, tenant architecture, integrations and n8n dependencies. Report the confirmed baseline, then proceed with implementation.

Do not inspect or modify Xposure.

Build the Estate Catalog and other features as reusable multi-tenant capabilities, not Limitless Realty-specific customizations. Preserve existing architecture and data wherever possible, make safe incremental changes, and continue through implementation, testing and production verification instead of stopping at a diagnosis report.
