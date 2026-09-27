# Phase C: Unified Customer and Conversation Layer

## Canonical model

Fluxknight treats `crm_customers`, `crm_conversations`, `crm_messages`, and `customer_timeline_events` as the business-facing customer truth.

Legacy `agent_conversations` and `conversation_messages` remain runtime compatibility surfaces until their callers are migrated. New channel work must use the canonical CRM services.

## Identity

Customer identity is organization scoped.

Identifiers:
- email
- phone
- WhatsApp phone
- external provider key
- web session
- voice identity
- Telegram identity

Resolution order is deterministic and tenant scoped. If supplied identifiers resolve to multiple customer records, Fluxknight creates a `customer_identity_conflicts` review record and does not merge automatically.

## Conversations

A canonical conversation is keyed by:
- organization
- customer
- channel
- external thread ID

External message IDs are unique per organization to prevent duplicate ingestion.

## Timeline

The unified timeline receives:
- inbound/outbound CRM messages
- appointments and appointment state changes
- CRM tasks and reminders
- lead lifecycle updates
- customer-scoped system/domain events
- Public Leo lead capture
- website evaluation capture

## Public inbound

Public Leo and website evaluations resolve into the Fluxknight platform organization, then link to:
- canonical customer
- canonical web conversation
- source lead/evaluation record

Public Leo chat history before contact capture is backfilled after the visitor is identified.

## Channel ingestion

Tenant WhatsApp inbound processing now resolves customers and conversations through the canonical CRM service and records both inbound and outbound messages in the unified timeline.

## Security

- Canonical identity mutation RPCs are service-role only.
- Tenant users read customer identifiers and timeline through `customers.view` or `customers.manage`.
- Identity conflict review requires `customers.manage`.
- Cross-tenant composite foreign keys remain the data boundary.
- Identity conflicts are not auto-merged.

## Follow-on

A destructive customer merge operation must be approval backed, audited, reversible where practical, and update every tenant-scoped dependent resource atomically. It is intentionally not part of the automatic resolver.
