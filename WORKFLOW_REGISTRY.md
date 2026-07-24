# Fluxknight Workflow Registry

The workflow registry is the canonical control layer for n8n workflows, voice agents, messaging automations, scheduled jobs, and future providers.

## Setup

1. Run `supabase-workflow-registry-setup.sql` in the Supabase SQL editor.
2. Confirm the existing server-side Supabase environment variables are configured.
3. Open `/dashboard/workflows` while authenticated as an admin.
4. Register workflows with `POST /api/workflows`.
5. Execute active workflows with `POST /api/workflows/run`.

## Authentication

API calls accept either:

- an authenticated admin session, or
- `x-limitless-api-key: <LIMITLESS_API_KEY>`

A bearer token containing `LIMITLESS_API_KEY` is also accepted.

## Register a workflow

```json
{
  "organization_id": "limitless-realty",
  "project_id": "maia",
  "workflow_key": "lead-qualification",
  "name": "Maia Lead Qualification",
  "description": "Qualifies a new real-estate lead and updates the CRM.",
  "provider": "n8n",
  "external_workflow_id": "n8n-workflow-id",
  "endpoint_url": "https://your-n8n.example/webhook/lead-qualification",
  "status": "active",
  "current_version": 1,
  "timeout_seconds": 60,
  "max_retries": 2
}
```

The endpoint performs an upsert using `organization_id + workflow_key`.

## Execute a workflow

```json
{
  "organization_id": "limitless-realty",
  "workflow_key": "lead-qualification",
  "payload": {
    "lead_id": "lead-id",
    "source": "whatsapp"
  }
}
```

Fluxknight sends the registered endpoint this contract:

```json
{
  "organization_id": "limitless-realty",
  "project_id": "maia",
  "workflow_key": "lead-qualification",
  "workflow_version": 1,
  "workflow_run_id": "run-uuid",
  "payload": {}
}
```

It also includes these headers:

- `x-fluxknight-run-id`
- `x-fluxknight-workflow-key`

Every call is recorded in `workflow_runs` with its status, duration, output, and error message.

## Current scope

This foundation includes:

- workflow registration
- workflow status and version metadata
- synchronous webhook execution
- execution history
- timeout recording
- dashboard visibility

Retries, encrypted connection management, callback-based asynchronous runs, and organization-level RBAC belong in the next implementation milestone.
