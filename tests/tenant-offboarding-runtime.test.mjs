import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runTenantWorkIfActive } from "../lib/tenant-offboarding-guard.mjs";

test("offboarding suppresses provider work for inactive tenants and preserves active work", async (t) => {
  const db = new PGlite();
  t.after(async () => db.close());
  await db.exec(`
    CREATE TABLE organizations (id text PRIMARY KEY, status text NOT NULL);
    CREATE TABLE queued_work (organization_id text PRIMARY KEY, status text NOT NULL);
    INSERT INTO organizations VALUES ('inactive', 'inactive'), ('active', 'active');
    INSERT INTO queued_work VALUES ('inactive', 'queued'), ('active', 'queued');
  `);

  let providerCalls = 0;
  for (const organizationId of ["inactive", "active"]) {
    const { rows } = await db.query("SELECT status FROM organizations WHERE id = $1", [organizationId]);
    const gate = await runTenantWorkIfActive(
      rows[0]?.status,
      async () => {
        providerCalls += 1;
        await db.query("UPDATE queued_work SET status = 'delivered' WHERE organization_id = $1", [organizationId]);
      },
      async () => {
        await db.query("UPDATE queued_work SET status = 'cancelled' WHERE organization_id = $1", [organizationId]);
      },
    );
    assert.equal(gate.active, organizationId === "active");
  }

  const { rows } = await db.query("SELECT organization_id, status FROM queued_work ORDER BY organization_id");
  assert.deepEqual(rows, [
    { organization_id: "active", status: "delivered" },
    { organization_id: "inactive", status: "cancelled" },
  ]);
  assert.equal(providerCalls, 1, "only active tenant work reaches the mocked provider");
});
