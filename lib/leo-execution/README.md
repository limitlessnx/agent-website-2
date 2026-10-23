# Leo execution migration boundary

This folder contains the provider-neutral boundary for server-authorized Leo tool execution.

## Current layout

- `dispatcher.ts`: validates the dispatch envelope's required identifiers and invokes the selected provider.
- `providers/`: reserved for explicit, separately tested provider adapters as the migration advances.

## Safety rules

- The current `legacy_n8n` adapter remains the default until a replacement adapter is implemented and validated.
- Do not move identity resolution, tool authorization, approval checks, tenant scoping, signing, or audit ownership out of their existing canonical layers.
- Do not put provider credentials in source files.
- Do not retry side-effecting actions unless the provider contract carries a stable idempotency key.
- A provider must fail closed when it cannot honor a tool's safety or lifecycle contract.
- This folder is not permission to remove n8n workflows or integrations elsewhere in the product.
