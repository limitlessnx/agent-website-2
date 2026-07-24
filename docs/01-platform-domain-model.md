# Fluxknight Platform Domain Model

## Purpose

This document defines the canonical ownership hierarchy for Fluxknight. It sits between the enterprise charter and individual agent-family specifications such as Limitless Realty.

## Ownership hierarchy

```text
Organization
├── Branches
├── Memberships
├── Roles and permissions
├── Agent-family instances
│   ├── Projects
│   ├── Agents
│   ├── Workflows
│   ├── Integrations
│   └── Business data
└── Audit history
```

## Canonical entities

### Organization

A tenant using Fluxknight. It owns users, branches, agent families, integrations, billing settings, and business data.

### Branch

An optional operating unit inside an organization. A branch may represent an office, region, department, or sales team.

### User

An authenticated person. Authentication remains in Supabase Auth. Application ownership and permissions are represented through memberships.

### Membership

Connects a user to an organization and optionally a branch. A user may belong to more than one organization.

### Role

A named permission bundle such as owner, manager, staff, or viewer.

### Permission

A granular capability such as `leads.read`, `agents.publish`, or `workflows.retry`.

### Agent template

A reusable industry or business template. Templates contain default prompts, tools, workflows, and module configuration but never tenant customer data.

### Agent family

An installed, tenant-owned instance of an agent template. Limitless Realty is the first agent family.

### Project

A bounded operational area inside an agent family, such as Maia, Lead Follow-up, Campaigns, or Reporting.

### Agent

A versioned AI worker belonging to one agent family and project.

### Workflow

A registered automation owned by an organization, agent family, and project. The external provider may be n8n, Trigger.dev, or a custom API.

### Integration

A provider connection available to an organization, agent family, or project. Secret values remain in provider or environment secret stores; the database stores only references.

## Required tenant scope

Every tenant-owned record must include `organization_id`.

Records associated with a business unit should also include `branch_id`.

Records associated with an agent family should include `agent_family_id`.

Records associated with a project or agent should include `project_id` and, when applicable, `agent_id`.

## Platform relationship rules

1. An organization owns zero or more branches.
2. A user joins an organization through a membership.
3. A membership receives roles through membership-role records.
4. An agent family belongs to exactly one organization.
5. A project belongs to exactly one agent family.
6. An agent belongs to exactly one project and agent family.
7. A workflow belongs to one organization and may be scoped to a branch, agent family, project, and agent.
8. Templates are reusable platform assets; agent-family instances are tenant-owned.
9. Tenant business data never lives inside templates.
10. Every privileged mutation must create an audit-log record.

## Initial seeded domain

```text
Organization: Fluxknight
Agent family: Limitless Realty
Project: Maia Real Estate Agent
Agent: Maia
```

## Compatibility with the current repository

The current workflow registry uses text organization and project identifiers. The first migration introduces canonical UUID domain tables without deleting or rewriting existing workflow records. Later migrations will backfill UUID relationships and then update application queries incrementally.

## Migration stages

1. Create canonical domain tables.
2. Seed Fluxknight, Limitless Realty, and Maia.
3. Add nullable UUID ownership columns to workflow tables.
4. Backfill existing workflow ownership from current text slugs.
5. Update TypeScript types and repository services.
6. Make UUID ownership columns required only after validation.
7. Introduce RLS policies based on organization memberships.
