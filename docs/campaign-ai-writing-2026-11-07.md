# Campaign AI writing

Adds **Generate with AI** and **Improve with AI** to the Limitless campaign editor and Xposure's linked-template campaign page. Describe the message or improve existing values, review the suggested fields, then explicitly apply or discard. Applying updates the existing template preview; sending remains a separate action. Generation never enrolls a client, dispatches WhatsApp, retries an unknown outcome, or modifies an approved template.

## Scope and implementation

- Builds on PR #349's linked Xposure templates, tenant authorization, reviewed phone imports and current consent checks. Includes all current main changes through `5d3784e97f33ba3c73322fb9da4ab0994c7dfd18`. PR #351's follow-up count/runner correction is separate and remains pending.
- Separate authenticated draft endpoints derive organization identity from the session/admin scope, enforce campaign permissions and plan access, reload linked templates with live Meta approval, and match template name, purpose, language and ordered fields. No client-supplied template body or organization scope is trusted.
- Xposure's business name and Limitless estate name/location/price use server facts. AI generates only editable message values, never customer names. Limitless property lookup is tenant-scoped. Unsupported/mismatched contracts fail closed; hotel and other portal experiences are unchanged.
- Reuses the existing tenant model router, structured-output provider and `web_ai` credit reservation. Reservations occur before model use; a model failure can consume a reservation, as in existing metered flows. The editor discloses that AI credits apply.
- Output must contain exactly the permitted fields, all nonempty, single-line and at most 1,024 characters, with no leftover placeholders. Numeric changes/additions are rejected; improvement also checks that numeric facts in the original write-up are retained. These checks supplement human review and do not prove every generated sentence is factually correct.
- Suggestions never overwrite the original automatically. Edits invalidate a suggestion; responses arriving after edits are discarded. Switching template/property unmounts the writer and aborts the request. Errors leave the original intact. No automatic send/retry.
- Relationship campaigns now serialize greeting and call-to-action only, so an old supporting paragraph from another campaign cannot occupy the wrong template slot.

## Validation

14 new service/auth/tenant/contract tests, plus relevant Xposure, manual activation, property campaign and gateway regression tests. Repaired existing campaign test fixtures: a missing normalizer/URL mock, malformed escaped test syntax, cross-VM object comparisons and an obsolete unsupported-template case. Provider delivery code is unchanged.

Local targeted campaign checks: 58 passed, plus the added authoritative-business-name test. Hotel messaging regressions: 26 passed. Local broader support: 525 passed, with the known Windows path separator assertion in `trigger-schedules-paused.test.mjs` failing; Linux CI provides the applicable full regression/build result. The first local full build was stopped after exhausting practical machine resources during parallel verification; it did not report a compile failure. Browser interaction checks passed at 1440/1024/768/390 widths, with no overflow, runtime errors or send requests. These cover generation, improvement, explicit apply/discard, unchanged original text on failure, stale-result rejection, both editor integrations and their previews. CI evidence is recorded in the PR after completion.

No production migration, configuration change, live customer send or production promotion is part of this change. Live authenticated AI-provider behavior and physical-device contact selection need a controlled post-approval check. Do not merge/promote without passing checks and explicit user production confirmation.
