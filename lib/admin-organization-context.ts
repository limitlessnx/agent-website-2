import { cookies } from "next/headers";

export type SystemOrganizationId = "fluxknight" | "limitless-realty" | "gencouv";
export type AdminOrganizationContext =
  | { kind: "system"; id: SystemOrganizationId; name: string }
  | { kind: "tenant"; id: string; name?: string };

const COOKIE_NAME = "fluxknight_admin_organization";

export const SYSTEM_ORGANIZATIONS: Array<{
  id: SystemOrganizationId;
  name: string;
  href: string;
}> = [
  { id: "fluxknight", name: "Fluxknight", href: "/dashboard" },
  { id: "limitless-realty", name: "Limitless Realty", href: "/dashboard/limitless/leads" },
  { id: "gencouv", name: "Gencouv", href: "/dashboard/gencouv" },
];

export function parseAdminOrganizationContext(value?: string | null): AdminOrganizationContext {
  const raw = String(value || "").trim();
  if (raw.startsWith("tenant:")) {
    const id = raw.slice("tenant:".length).trim();
    if (id) return { kind: "tenant", id };
  }
  const system = SYSTEM_ORGANIZATIONS.find((item) => `system:${item.id}` === raw);
  return system
    ? { kind: "system", id: system.id, name: system.name }
    : { kind: "system", id: "fluxknight", name: "Fluxknight" };
}

export async function getAdminOrganizationContext() {
  const store = await cookies();
  return parseAdminOrganizationContext(store.get(COOKIE_NAME)?.value);
}

export function serializeAdminOrganizationContext(input: { kind: "system" | "tenant"; id: string }) {
  if (input.kind === "tenant") return `tenant:${input.id.trim()}`;
  const allowed = SYSTEM_ORGANIZATIONS.some((item) => item.id === input.id);
  return allowed ? `system:${input.id}` : "system:fluxknight";
}

export const ADMIN_ORGANIZATION_COOKIE = COOKIE_NAME;
