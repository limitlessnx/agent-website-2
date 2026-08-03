# Fluxknight Flagship Workflow Contracts

These contracts define the six primary tenant workflows. Every workflow is shared across organisations and must receive explicit tenant context. No workflow may infer an organisation from a phone number, email address, webhook URL, or provider account.

## Universal envelope

```json
{
  "organization_id": "uuid",
  "agent_id": "uuid",
  "conversation_id": "uuid-or-null",
  "customer_id": "uuid-or-null",
  "idempotency_key": "stable-unique-key",
  "channel": "whatsapp|email|web_chat|telegram|voice|internal",
  "event_type": "string",
  "input": {}
}
```

### Required controls

1. Reject missing `organization_id`, `agent_id`, or `idempotency_key`.
2. Enqueue through `/api/internal/runtime/enqueue` using `x-runtime-secret`.
3. Prepare through `/api/internal/runtime/worker` using the returned `execution_id`.
4. Do not expose `RUNTIME_GATEWAY_SECRET` to clients or channel providers.
5. Treat `execution_enabled: false` as a hard stop. No AI-provider, n8n tool, CRM, messaging, calendar, or voice action may run.
6. Every external mutation must eventually include an idempotency key and an execution/tool-call reference.
7. Every database query and provider credential lookup must be scoped by `organization_id`.

## 1. AI Sales and Lead Qualification

**Workflow key:** `ai_sales_qualification_v1`

**Triggers:** inbound message, form lead, imported lead, call transcript.

**Purpose:** capture contact information, identify need, qualify against tenant rules, create or update the CRM lead, request appointment booking, and hand off high-intent or sensitive conversations.

**Expected tools:**
- `crm.create_lead`
- `crm.update_lead`
- `knowledge.search`
- `appointment.request`
- `handoff.request`
- channel reply tool

**Output:** qualification status, captured fields, recommended next action, tool intents, handoff state, customer reply.

## 2. Customer Support AI

**Workflow key:** `customer_support_v1`

**Triggers:** inbound support message, failed transaction event, order or service question.

**Purpose:** search tenant knowledge, answer supported questions, create a support case, collect missing evidence, and escalate complaints, legal matters, refunds, or low-confidence answers.

**Expected tools:**
- `knowledge.search`
- `support.create_ticket`
- `support.update_ticket`
- `handoff.request`
- channel reply tool

**Output:** answer, knowledge citations, ticket state, escalation state, confidence band.

## 3. Follow-up and CRM Automation

**Workflow key:** `crm_follow_up_v1`

**Triggers:** lead inactivity, quotation sent, missed appointment, no reply, pipeline stage change.

**Purpose:** choose the approved tenant follow-up sequence, schedule the next touch, stop on reply or human takeover, and update CRM activities.

**Expected tools:**
- `crm.get_lead`
- `crm.create_activity`
- `followup.schedule`
- approved channel send tool
- `handoff.request`

**Output:** sequence step, scheduled time, stop reason, CRM activity reference.

## 4. Appointment Booking and Reminders

**Workflow key:** `appointment_booking_v1`

**Triggers:** booking intent, qualified lead, reschedule request, reminder schedule.

**Purpose:** read tenant availability, offer slots, create or update appointments, send confirmations and reminders, and prevent duplicate bookings.

**Expected tools:**
- `calendar.search_availability`
- `calendar.create_event`
- `calendar.update_event`
- `calendar.cancel_event`
- reminder send tool

**Output:** appointment state, slot, timezone, calendar reference, reminder schedule.

## 5. Outbound Email, Cold Outreach and CRM

**Workflow key:** `outbound_email_crm_v1`

**Triggers:** approved campaign launch, imported lead batch, scheduled sequence step, reply event.

**Purpose:** validate campaign eligibility, personalise approved templates, send within tenant and domain limits, detect replies, stop sequences, and update CRM.

**Expected tools:**
- `campaign.load_leads`
- `email.send`
- `email.check_reply`
- `crm.create_activity`
- `followup.schedule`

**Output:** attempted, accepted, failed, skipped, reply state, CRM references.

## 6. Voice AI Receptionist

**Workflow key:** `voice_receptionist_v1`

**Triggers:** inbound call, approved outbound call job, transfer callback.

**Purpose:** identify the caller, answer supported questions, qualify leads, book appointments, record call summaries, and transfer to humans when required.

**Expected tools:**
- `knowledge.search`
- `crm.create_or_update_contact`
- `appointment.request`
- `voice.transfer`
- `handoff.request`
- `memory.store_summary`

**Output:** call disposition, summary, captured fields, appointment state, transfer state, usage seconds.

## Activation gate

A workflow can become active only when all of the following are true:

- tenant agent readiness is 100%;
- required integrations are connected;
- agent workflow assignment is approved;
- provider assignment is active in Super Admin;
- plan entitlement and usage limits permit execution;
- workflow contract version matches the platform registry;
- preview and tenant-isolation tests pass;
- the n8n workflow is imported with `active: false`, reviewed, then explicitly activated.
