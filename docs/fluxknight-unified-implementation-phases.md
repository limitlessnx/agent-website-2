# Fluxknight Unified Implementation Roadmap

## Product rules confirmed

- The privileged configuration role is **Fluxknight Super Admin**.
- Clients provide only their name, organization name, business knowledge, and provider authorizations required for enabled channels.
- Business knowledge is submitted as either one PDF upload or text in one guided text box.
- Clients enter the organization dashboard after initial identity onboarding, before all integrations are active.
- The dashboard gives setup hints and shows the current setup state.
- The Fluxknight Super Admin programs, tests, and publishes the agents.
- Twilio handles the provider-side WhatsApp and telephony configuration after the client completes the authorization link.
- Email automation is available only on a higher plan and follows the same managed setup model.
- Each plan has a dedicated Flux Credit allowance.
- Plan entitlements determine both **which channels are available** and **how many agents may be active**.
- All organizations use a shared dashboard architecture with organization-specific wording, modules, and data.
- Basic is WhatsApp-only with human handoff; it does not include Web AI, email, voice, or self-service agent configuration.

---

# Target commercial model

| Plan | Active agents | Included channels | Included capabilities |
|---|---:|---|---|
| **Basic** | 1 | WhatsApp | WhatsApp automation, approved business knowledge, lead/customer detail capture, basic qualification, human handoff, basic dashboard |
| **Plus** | 1 | WhatsApp | Everything in Basic plus WhatsApp follow-ups, reminders, missed-lead recovery, and higher Flux Credits |
| **Business** | 2 | WhatsApp + Voice | Everything in Plus plus a voice/call agent, call qualification, call summaries, human transfer, team/admin controls, and higher Flux Credits |
| **Business+** | 4 or configurable multiple | WhatsApp + Voice + Email + Web Chat | Everything in Business plus email automation, web chat, industry/customer databases, advanced workflows, integrations, and highest/configurable Flux Credits |

## Canonical agent allocation

```text
Basic       → WhatsApp Agent
Plus        → WhatsApp Agent with follow-up/reminder capability
Business    → WhatsApp Agent + Voice Agent
Business+   → WhatsApp Agent + Voice Agent + Email Agent + Web Chat Agent
```

The allocation must be represented centrally and enforced server-side. The client must not be able to activate an agent or channel outside the organization’s plan.

---

# Phase 0 — Baseline, decisions, and safety contract

## Goal

Establish one source of truth before changing behavior.

## Work

1. Confirm the canonical plan names and legacy slug mapping:
   - Basic
   - Plus
   - Business
   - Business+
2. Confirm the exact monthly Flux Credit allowance for each plan from the pricing and billing source.
3. Audit existing pricing copy, plan definitions, agent catalog entries, subscription records, and legacy slugs.
4. Identify existing email, voice, WhatsApp, web chat, handoff, and knowledge tables before creating migrations.
5. Preserve existing tenant isolation and Super Admin authorization boundaries.
6. Document migration behavior for existing organizations:
   - Existing Basic organizations receive WhatsApp-only access.
   - Existing Business organizations are capped at two agents.
   - Existing Business+ organizations retain supported allocations and are migrated to the new channel model.

## Acceptance criteria

- One canonical plan definition is identified.
- Legacy plan slugs resolve to the correct new plan.
- No existing customer data or subscription history is deleted.
- Existing paid customers cannot accidentally lose access because of a UI-only change.
- A written migration map exists for current organizations and agents.

---

# Phase 1 — Canonical commercial, entitlement, and agent-allocation model

## Goal

Make plan access, channel access, agent count, and Flux Credit allowances explicit and reusable everywhere.

## Work

Update the central commercial model, primarily:

```text
lib/fluxknight-plans.ts
lib/flux-commercial.ts
lib/flux-credits.ts
lib/agent-catalog.ts
lib/agent-management.ts
```

Add or formalize:

```ts
type FluxAgentChannel = "whatsapp" | "voice" | "email" | "web_chat";

type FluxPlanAllocation = {
  plan: FluxPlanCode;
  maxAgents: number;
  includedChannels: FluxAgentChannel[];
  requiredAgents: Array<{
    key: string;
    name: string;
    channel: FluxAgentChannel;
  }>;
  monthlyCredits: number;
};
```

Add explicit features:

```text
whatsapp_automation
human_handoff
whatsapp_follow_ups
whatsapp_reminders
voice_automation
email_automation
web_chat_automation
team_admin
cross_channel
industry_database
client_database
advanced_workflows
custom_integrations
```

Add central helpers:

```text
getFluxPlanDefinition()
getPlanAgentAllocation()
getAllowedAgentChannels()
getMaximumAgentCount()
hasFluxFeature()
requireFluxFeature()
getRequiredPlanForFeature()
getFluxCreditAllowance()
```

## Acceptance criteria

- Every plan has one monthly Credit allowance.
- Every plan has a maximum active-agent count.
- Every plan has explicit channel entitlements.
- Basic explicitly includes WhatsApp automation and human handoff only.
- Email and web chat are unavailable below Business+.
- Voice is unavailable below Business.
- The same model can be called by UI, API, runtime, billing, and Super Admin code.

---

# Phase 2 — Database migrations and commercial control plane

## Goal

Persist plan allocations, organization entitlements, channel status, setup status, and Credit state safely.

## Work

Add migrations only after checking existing tables and RPCs. Reuse current structures where possible.

Likely entities:

```text
organization_entitlements
organization_agent_allocations
organization_channel_bindings
organization_setup_status
organization_knowledge_submissions
organization_email_bindings
email_automation_policies
email_suppression_entries
email_consent_events
```

Required fields should include:

```text
organization_id
plan_code
agent_key
channel
allocation_status
setup_status
provider
provider_connection_id
enabled_at
paused_at
last_error
metadata
created_at
updated_at
```

Add safe RPCs for:

```text
get organization commercial snapshot
synchronize plan allocation
activate or pause an agent
activate or pause a channel
create idempotent trial
record Credit usage
```

All privileged allocation mutations must be restricted to `service_role` or the authorized Fluxknight Super Admin path.

## Acceptance criteria

- Existing organizations can be assigned an allocation without duplication.
- Re-running synchronization is idempotent.
- Client users cannot directly grant themselves an agent or channel.
- Provider credentials remain server-side and tenant-scoped.
- Database constraints prevent duplicate active allocations for the same agent key and organization.

---

# Phase 3 — Minimal client onboarding and business knowledge submission

## Goal

Reduce client onboarding to identity plus one business-information submission flow.

## Client inputs

Initial onboarding:

```text
Full name
Organization name
```

After dashboard entry:

```text
Business information: PDF upload OR one large text box
```

Guidance in the text box must explain that the client should include:

- What the organization does
- Products, services, properties, or rooms
- Prices and packages
- Frequently asked questions
- Opening hours
- Locations and service areas
- Booking, sales, or enquiry process
- Payment, refund, cancellation, delivery, or eligibility policies
- Important customer restrictions
- Human handoff contact details, if available

## Work

Update:

```text
app/account/
app/onboarding/
app/api/client-onboarding/
lib/client-onboarding.ts
lib/client-workspace-onboarding.ts
```

Replace the current long questionnaire as the primary path with:

```text
identity setup → dashboard → business information submission
```

Keep the existing structured fields only as optional metadata or an admin-assisted fallback, not as a client requirement.

Create an idempotent setup request when the business information is submitted.

## Acceptance criteria

- A client can complete initial setup with only name and organization name.
- A client can reach the dashboard before WhatsApp, voice, email, or web chat is active.
- PDF and text submissions are stored against the correct organization.
- The submission is visible to Fluxknight Super Admin.
- Re-submission updates or versions the knowledge request without creating duplicate organizations.
- The UI clearly states that Super Admin configures the agents.

---

# Phase 4 — Organization-specific dashboard shell

## Goal

Create one reusable dashboard architecture with industry-specific wording and sections.

## Shared dashboard structure

```text
Dashboard shell
  ├── Organization identity and welcome
  ├── Setup progress and next action
  ├── Plan and Flux Credit status
  ├── Channel/agent status
  ├── Organization metrics
  ├── Quick actions
  ├── Industry-specific records
  ├── Lead/customer pipeline
  ├── Upcoming appointments or equivalent
  ├── Recent activity
  └── Locked features and upgrade prompts
```

## Configuration model

```ts
type OrganizationDashboardConfig = {
  industry: string;
  title: string;
  description: string;
  metricLabels: string[];
  quickActions: string[];
  sections: string[];
  navigation: string[];
};
```

Use the existing `lib/industryExperience.ts` as the starting vocabulary layer, but extend it into dashboard composition rather than only changing labels.

## Real-estate first implementation

The real-estate dashboard should support the visual and structural direction of the reference image:

```text
Properties
Leads
Viewings
Sales value
Property listings
Lead pipeline
Upcoming viewings
Recent activity
```

Use real tenant-scoped data. Do not invent production metrics or records merely to match the reference.

For Basic, the dashboard may show relevant organization modules, but actions outside the plan must be locked.

## Acceptance criteria

- All organizations use the same dashboard components.
- Real-estate wording is different from hotels, restaurants, salons, clinics, and other industries.
- Dashboard records are always filtered by organization ID.
- Empty states are clear and useful.
- Locked items show the required plan and upgrade path.
- Mobile navigation adapts labels to the organization.

---

# Phase 5 — Automatic Basic/Plus WhatsApp setup path

## Goal

Make WhatsApp the first managed channel for Basic and Plus.

## Client flow

```text
Dashboard
  ↓
Connect WhatsApp
  ↓
Secure WhatsApp Business authorization link
  ↓
Twilio provider configuration
  ↓
Return to dashboard with connection status
```

The client does not enter Twilio credentials or agent configuration.

## Super Admin flow

```text
Review business submission
  ↓
Create/configure WhatsApp Agent
  ↓
Approve knowledge
  ↓
Configure behavior and escalation rules
  ↓
Assign human-agent name and number/placeholder
  ↓
Run inbound message test
  ↓
Run handoff test
  ↓
Publish agent
```

## Setup statuses

```text
awaiting_business_information
business_information_received
awaiting_whatsapp_connection
whatsapp_connected
agent_configuration_in_progress
testing
ready_for_activation
active
paused
```

## Human handoff

The organization must support:

```text
Dedicated agent name
Dedicated WhatsApp number
Fallback number
Assignment status
Escalation categories
Availability/SLA
```

Before assignment:

```text
Dedicated human agent: Pending assignment
Number: Pending assignment
```

## Acceptance criteria

- Basic and Plus have exactly one WhatsApp agent allocation.
- WhatsApp cannot activate until provider connection and Super Admin publish checks pass.
- Human handoff can be recorded even when the dedicated number is pending.
- AI does not claim a human transfer succeeded when it did not.
- Basic clients cannot edit prompts, workflows, or publish state.

---

# Phase 6 — Plus follow-ups, reminders, and same-channel automation

## Goal

Add higher-value WhatsApp automation without creating a second agent.

## Work

Enable for Plus:

```text
WhatsApp follow-up
WhatsApp reminders
Missed-lead recovery
Appointment/booking reminders where applicable
Scheduled nurture sequences
```

Use the same WhatsApp agent allocation with additional entitlement checks.

## Acceptance criteria

- Basic cannot invoke follow-up or reminder actions.
- Plus can invoke only approved WhatsApp follow-up/reminder workflows.
- Each automated action is metered separately.
- Unsubscribed or suppressed contacts are not messaged.
- Follow-up jobs are tenant-scoped and idempotent.

---

# Phase 7 — Business voice agent and two-agent allocation

## Goal

Give Business exactly two customer-facing agents: WhatsApp and Voice.

## Client setup

The client should:

1. Click the voice setup link.
2. Authorize or confirm the required telephony connection.
3. Confirm business phone/call destination details.
4. Return to the dashboard to see setup progress.

## Super Admin setup

Configure:

```text
Voice agent identity
Greeting
Approved business knowledge
Language and voice
Business hours
After-hours response
Qualification questions
Call transfer rules
Human handoff number
Voicemail behavior
Call summary format
Recording/transcription policy
Maximum call duration
```

## Voice handoff behavior

```text
Attempt live transfer
If unavailable, collect caller details
Create human handoff
Send summary to assigned team
Never claim successful transfer when transfer failed
```

## Acceptance criteria

- Business has exactly two standard agent allocations.
- Voice is unavailable to Basic and Plus.
- Voice calls are metered by duration and/or configured action.
- Voice provider credentials and recordings are protected.
- Call transfer failure creates a follow-up/handoff record.
- Super Admin can test and publish the voice agent.

---

# Phase 8 — Business team, cross-channel context, and operational controls

## Goal

Activate the remaining Business capabilities without accidentally granting Business+ channels.

## Business capabilities

```text
Team/admin controls
WhatsApp + voice context
Higher Flux Credit allowance
Human escalation controls
Workflow visibility
Operational reporting
```

Business must not automatically receive:

```text
Email Agent
Web Chat Agent
Business+ databases
Advanced custom integrations
```

## Acceptance criteria

- Business team permissions are separate from agent/channel allocation.
- Cross-channel context includes only WhatsApp and voice.
- Email and web chat UI is visibly locked for Business.
- Direct API access to Business+ features is rejected server-side.

---

# Phase 9 — Business+ email automation

## Goal

Introduce email automation as a managed, higher-plan channel.

## Client setup

```text
Click Connect Email
  ↓
Choose supported provider
  ↓
Authorize through OAuth
  ↓
Confirm sender name and reply-to address
  ↓
Verify sending identity
  ↓
Return to dashboard
```

Preferred providers:

- Google Workspace/Gmail OAuth
- Microsoft 365 OAuth
- A controlled sending provider for higher-volume or campaign use

Do not collect mailbox passwords in the client portal.

## Required email configuration

```text
Organization name
Sender display name
Sending address
Reply-to address
Provider and connection ID
Business timezone
Business hours
Signature
Human handoff email
```

For provider-based sending, support:

```text
SPF
DKIM
DMARC
Bounce handling
Complaint handling
Unsubscribe/suppression list
```

## Super Admin email-agent setup

Configure:

```text
Email Agent identity
Approved knowledge
Tone and signature
Transactional triggers
Lead welcome sequence
Quote/proposal follow-up
Appointment confirmation/reminder
Missed-appointment follow-up
Dormant-lead reactivation
Reply detection
Human handoff rules
```

Separate transactional and marketing automation. Every marketing message must honor consent and unsubscribe state.

## Acceptance criteria

- Email is unavailable below Business+.
- Business+ receives an Email Agent allocation.
- OAuth tokens are encrypted or protected server-side.
- Email replies and outbound messages are tenant-scoped.
- Suppression, bounce, complaint, and unsubscribe controls work before sending.
- Email actions are metered with separate Flux Credit actions.
- Super Admin must approve and publish the Email Agent.

---

# Phase 10 — Business+ web chat and multi-agent package

## Goal

Complete the Business+ multi-channel agent suite.

## Allocation

```text
WhatsApp Agent
Voice Agent
Email Agent
Web Chat Agent
```

The system should support multiple specialized agents while maintaining one shared organization knowledge source and consistent handoff rules.

## Work

- Add web chat embed/configuration.
- Add domain/origin allow-listing.
- Configure web-chat knowledge and escalation.
- Add channel-specific prompts layered over common approved knowledge.
- Add agent health and publish status per channel.
- Add Super Admin test console for all channels.
- Prevent Business+ allocations from leaking across organizations.

## Acceptance criteria

- Business+ can activate all four standard channel agents.
- Each agent has its own provider status, configuration, test state, and publish state.
- Common knowledge changes can be reviewed before affecting multiple channels.
- Channel-specific behavior remains explicit.
- Web chat cannot be embedded on unauthorized domains.

---

# Phase 11 — Flux Credit wallet, channel metering, and exhaustion behavior

## Goal

Ensure every plan and every active channel consumes the organization’s dedicated Credit allocation correctly.

## Action categories

```text
whatsapp_ai
whatsapp_follow_up
whatsapp_reminder
voice_minute
email_ai
email_follow_up
web_chat_ai
```

Existing action names should be migrated carefully rather than breaking historical ledger records.

## Metering rules

```text
WhatsApp response       → whatsapp_ai
WhatsApp follow-up      → whatsapp_follow_up
WhatsApp reminder       → whatsapp_reminder
Voice interaction       → voice_minute
Email reply             → email_ai
Email sequence message  → email_follow_up
Web chat response       → web_chat_ai
```

## Exhaustion behavior

When the organization reaches 100% usage:

```text
Customer-facing automation pauses
Dashboard remains available
Business data remains available
Human operations remain available
Billing remains available
Upgrade path remains available
No silent postpaid overage is created
```

## Acceptance criteria

- Each plan receives the correct monthly allowance.
- Each charge is tenant-scoped and idempotent.
- Duplicate delivery/retry events do not double-debit.
- Credit exhaustion blocks automation before provider execution where possible.
- Human handoff and dashboard access remain available.
- Billing and usage displays use the same commercial snapshot as runtime gates.

---

# Phase 12 — Super Admin operations console

## Goal

Give Fluxknight Super Admin complete control over organization setup and activation.

## Super Admin workspace

```text
Organization identity
Plan and Credit allocation
Business PDF/text submission
Knowledge review and approval
WhatsApp Agent
Voice Agent
Email Agent
Web Chat Agent
Provider connection status
Human handoff configuration
Test console
Publish controls
Setup history
Usage and errors
```

## Checklist per organization

```text
[ ] Identity reviewed
[ ] Business information received
[ ] Knowledge approved
[ ] Plan allocation confirmed
[ ] Required agents created
[ ] Provider connections complete
[ ] Human handoff assigned
[ ] WhatsApp tested
[ ] Voice tested, if included
[ ] Email tested, if included
[ ] Web chat tested, if included
[ ] Credit wallet initialized
[ ] Agents published
[ ] Organization marked active
```

## Acceptance criteria

- Only authorized Super Admin users can configure or publish agents.
- Every action is audit logged.
- Super Admin can pause a channel without deleting configuration.
- Super Admin sees provider and runtime errors per organization.
- The client sees progress but not protected credentials or internal prompts.

---

# Phase 13 — Billing, upgrades, downgrades, and migration handling

## Goal

Keep subscriptions, allocations, agent counts, channels, and Credits synchronized.

## Upgrade behavior

```text
Basic → Plus
  Enable follow-ups/reminders on WhatsApp

Plus → Business
  Add Voice Agent and team/cross-channel controls

Business → Business+
  Add Email Agent and Web Chat Agent
  Add Business+ databases/workflows
```

## Downgrade behavior

A downgrade must not delete agents or data automatically.

Instead:

```text
Existing extra agents become paused or allocation_pending
New channel execution is blocked
Configuration and history are preserved
Super Admin receives an allocation warning
Client sees the required plan to restore the channel
```

## Acceptance criteria

- Billing webhooks are idempotent.
- Plan changes update entitlements and Credit allowances safely.
- Downgrades do not delete business knowledge, conversations, or agent configuration.
- Existing organizations are migrated with an auditable result.
- Paid users are not accidentally treated as Basic because of legacy slug differences.

---

# Phase 14 — Testing, security review, and release

## Automated tests

Add or update tests for:

1. Plan-to-agent allocation.
2. Plan-to-channel entitlement.
3. Basic WhatsApp-only behavior.
4. Plus follow-up and reminder access.
5. Business two-agent limit.
6. Business voice access.
7. Business+ email access.
8. Business+ web chat access.
9. Client onboarding with name and organization only.
10. PDF/text business submission.
11. Super Admin-only agent configuration.
12. Client inability to publish or edit prompts.
13. Provider authorization return flow.
14. Human handoff with pending number.
15. Human handoff with assigned number.
16. Voice transfer failure behavior.
17. Email unsubscribe and suppression.
18. Email OAuth/provider isolation.
19. Credit metering and retry idempotency.
20. Credit exhaustion behavior.
21. Upgrade and downgrade transitions.
22. Organization-specific dashboard wording.
23. Direct route/API authorization.
24. Tenant isolation across all channel runtimes.

## Validation commands

```bash
npm run prebuild
npm run lint
npm run build
npm test
```

Also inspect:

```bash
git diff
git status --short
```

## Release order

1. Deploy database migrations.
2. Deploy canonical commercial model and compatibility mappings.
3. Run organization allocation migration.
4. Deploy client onboarding/dashboard changes.
5. Enable Basic/Plus WhatsApp path.
6. Enable Business voice path.
7. Enable Business+ email and web chat behind controlled rollout flags.
8. Verify Super Admin activation for a test organization per plan.
9. Monitor Credit ledger, provider callbacks, and handoff delivery.
10. Expand rollout gradually.

---

# Recommended implementation order

The safest order is:

```text
Phase 0  Baseline and decisions
Phase 1  Canonical plan/entitlement/allocation model
Phase 2  Database control plane
Phase 3  Minimal onboarding and business submission
Phase 4  Organization dashboard shell
Phase 5  Basic/Plus WhatsApp path
Phase 6  Plus follow-ups/reminders
Phase 7  Business voice agent
Phase 8  Business team/cross-channel controls
Phase 9  Business+ email automation
Phase 10 Business+ web chat and multi-agent package
Phase 11 Flux Credit metering and exhaustion
Phase 12 Super Admin operations console
Phase 13 Billing and migrations
Phase 14 Testing and release
```

The foundational dependency is the canonical entitlement/allocation model. It should be implemented before UI locking, agent provisioning, email, voice, web chat, or billing changes so that every layer uses the same rules.
