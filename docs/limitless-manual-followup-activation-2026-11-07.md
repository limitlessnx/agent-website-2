# Manual Limitless follow-up activation

The lead action previously opened “Create follow-up draft” and posted only to the draft table. Even draft approval did not enroll a sequence. The lead action now opens “Activate follow-up” and activates the canonical Limitless Maia sequence directly after the operator confirms the customer's WhatsApp follow-up permission.

## Result

- “Activate follow-up now” replaces “Save as draft”. There is no second approval/draft stage for this action.
- One service-only database transaction verifies the active Limitless tenant, selected lead/property, unambiguous normalized phone and current opt-out state. It creates or resolves the canonical tenant contact, records the operator's permission confirmation, invokes the existing six-step enrollment RPC and stores the reason/notes in a manual-activation audit event.
- The sequence is active immediately; its first pending step is due at database `now()`. The remaining five steps retain the existing policy's timing. The result says queued, not sent/delivered. Reason and notes are internal context; they are not copied into a customer-facing message or treated as verified promotional terms.
- Repeating the request returns the same active sequence without restarting or duplicating its steps. Paused sequences require the existing resume control. Current lead/contact opt-outs and a latest opted-out sequence cannot be overridden by the operator checkbox. The transaction rolls back every contact/consent/sequence write on an incomplete schedule.
- The new property-list request does not load or join draft history. Load errors remain in the dialog with a Retry button. Activation errors stay visible in the dialog. Closing, focus return, keyboard trapping, busy state, synchronous duplicate-click protection and viewport scrolling are handled in the extracted dialog. Its portal stays inside the dashboard theme root and above floating controls.

Historical drafts and their existing review API are preserved. This does not automatically approve, activate or message any historical draft or customer.

## Verification

- 5 API tests: scoped actor/tenant, six steps and immediate first due time, anonymous/inactive/other-tenant denial, independent property loading, consent/identity/plan validation, opt-out conflicts, existing sequence and missing migration responses.
- 7 PGlite tests execute the real canonical and new SQL: active enrollment, repeat idempotency, tenant/property/consent/opt-out rejection, contact ambiguity, paused-sequence protection, full rollback and denial for browser database roles.
- 58 existing canonical follow-up regressions pass.
- 134 Maia regressions pass.
- 4 migration-ledger checks pass with the new unapplied migration explicitly registered.
- TypeScript and focused lint pass.
- 10 browser interaction checks pass against the actual LeadsCrm/dialog and dashboard theme with isolated test endpoints. Widths 1440, 1024, 768 and 390 have no horizontal overflow or modal clipping. Browser console has no runtime errors. These checks use fixture contacts and mocked activation responses, not live production enrollment or WhatsApp messages.

The first TypeScript pass caught a nullable property reference inside the schedule callback; a captured verified title fixed it. The browser's duplicate-click check caught two requests before React rendered its busy state; a synchronous request guard fixed it. Both checks were repeated successfully.

## Release order and limits

1. Review the branch and require CI production build/regressions to pass.
2. After release approval, apply only `20261106213418_limitless_manual_followup_activation.sql` to the intended database. It adds two service-only functions; no new table or browser grants. Do not apply unrelated pending migrations.
3. Verify the new function and service-only grants, then deploy the application from the reviewed commit. Until the function is installed, the API explicitly returns 503 rather than falsely claiming activation.
4. Verify the existing canonical follow-up runner calls the protected `/api/limitless/maia/followups` endpoint and processes due canonical steps. This change creates immediately due work; it does not add a new scheduler, invoke a global drain, bypass the approved-template/service-window gates or claim synchronous provider delivery. A read-only production check found zero canonical steps, so successful production canonical delivery/runner activity could not be established from existing records.
5. With a separately approved tenant test contact, verify the active sequence, six steps, first pending due time, one provider receipt and duplicate-request reuse. No live contact was enrolled or messaged during implementation.

Rollback the application artifact if needed; preserve audit evidence and explicitly pause any sequences already activated before stopping the application flow. Do not drop sequence/audit data as rollback.

Database-function implementation follows the [Supabase function security guidance](https://supabase.com/docs/guides/database/functions), including a fixed search path and explicit execution grants.
