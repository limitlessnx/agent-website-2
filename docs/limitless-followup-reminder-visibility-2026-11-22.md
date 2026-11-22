# Follow-up and installment reminder visibility

Base: main `4ab0b715d1a783f6f2baa8197fd2eda64d2447fa`. Open PRs were inspected before editing. PR #351 already contains a canonical lead-state reader and CRM presentation fix; this branch adapts those relevant changes onto current main and extends them to Home, Follow-up Control and installment counters. It does not merge or overwrite that PR. Main already has the four-variable follow-up template contract, so its historical runner patch is not reapplied. PRs #324 and #227 were reviewed; their runtime/schema changes are outside this read-only presentation fix.

## Diagnosis

The dashboard used legacy lead-stage fields rather than canonical active sequences. A newly activated sequence can therefore exist before the first successful send while appearing inactive in the old UI. Provider acceptance can also precede a delivery rejection, so submission and delivery must be displayed separately. Reminder-plan eligibility must use the existing sweep predicates rather than the length of a paginated list.

Investigation was read-only. Customer-specific records, delivery history, schedules and production counts are omitted from this public report. No production data was changed or message sent/retried by this workstream.

## Changes and boundaries

- Canonical sequence state supplies active client counts in Home, Lead CRM and Follow-up Control. A client is counted once even with multiple property sequences or steps, including before the first successful send. Paused/stopped/closed sequences do not inflate active counts.
- Collapsed lead cards display active/paused status. Failed/unknown latest delivery outcomes and consent problems remain visible as review requirements.
- Existing outbound tracking supplies latest-attempt delivery outcomes for the control view. Accepted, delivered and rejected outcomes are distinct. Receipt failures never rewrite sent steps, reset duplicate protection or make an accepted message retryable. No messaging, scheduling, consent or provider configuration behavior is changed.
- Exact tenant-scoped database counts show active installment reminder plans on Home and Installment Management. Payments shows current active plans/pending attempts and historical accepted/failed/unknown attempts. Counting is independent of list pagination, with the same eligibility predicates as the existing reminder sweep.
- Read failures show unavailable rather than zero/healthy automation. Existing sequence controls retain their exact tenant/customer/property/step authorization.
- No migrations, new provider calls or duplicate automation services. Flux Social, billing, Maia execution and other industries remain intact.

## Verification and evidence

Behavioral tests cover stage-zero enrollment, unique client counting, inactive sequence exclusion, tenant scoping, failed reads/truncation, exact reminder counts over list limits, latest attempt selection, rejected accepted sends without retry, and preservation of sequence mutation guards. The pre-existing installment UX test expected a removed next-day reminder field; it now asserts the current due-date/template-based schedule without changing runtime behavior.

The new Playwright suite renders real Home, CRM, Follow-up Control, Payments and Installment Management with local synthetic records, read outages and blocked external providers at 360/430/768/1024/1440/1920. Screenshots and traces are uploaded by the dedicated visibility workflow. These are authenticated synthetic fixtures, not authenticated production-browser acceptance. Local browser failures in early runs exposed a collapsed-card status assertion; the status is now visible on the collapsed card and the final suite checks it there.

Release evidence, actual final check results and deployment URLs are recorded in the pull request. Production changes, if released under standing owner approval, are code only; no customer record, schedule, attempt, balance or consent is modified by this branch.
