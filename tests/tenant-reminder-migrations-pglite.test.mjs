import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const migrations = [
  "20261025210257_20261024140400_secure_workspace_provisioning_rpc.sql",
  "20261025210354_20261024140500_tenant_reminder_rules.sql",
  "20261025210407_20261024140600_tenant_reminder_executions.sql",
  "20261025210412_20261024140700_tenant_reminder_notifications.sql",
  "20261025210424_20261024140800_tenant_customer_contacts.sql",
  "20261025210436_20261024140900_tenant_appointment_lifecycle_reminders.sql",
  "20261025210454_20261024141000_appointment_capacity_guard.sql",
];

async function createFixtureDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE TABLE public.organizations (id uuid PRIMARY KEY);
    CREATE TABLE public.appointments (
      id uuid PRIMARY KEY,
      organization_id uuid NOT NULL REFERENCES public.organizations(id),
      title text NOT NULL DEFAULT '',
      status text NOT NULL,
      start_at timestamptz,
      end_at timestamptz,
      timezone text NOT NULL DEFAULT 'UTC',
      source_event_id text,
      UNIQUE (organization_id, id),
      UNIQUE (organization_id, source_event_id)
    );
    CREATE TABLE public.appointment_availability_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES public.organizations(id),
      availability_configuration jsonb NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE FUNCTION public.provision_client_workspace(uuid, text, text, text, text)
      RETURNS void LANGUAGE sql AS $$ SELECT $$;
    CREATE FUNCTION public.provision_client_organization(uuid, text, text, text, text)
      RETURNS void LANGUAGE sql AS $$ SELECT $$;
  `);

  for (const migration of migrations) {
    await db.exec(readFileSync(`supabase/migrations/${migration}`, "utf8"));
  }
  return db;
}

test("main reminder and appointment migrations apply with tenant-safe constraints", async (t) => {
  const db = await createFixtureDatabase();
  t.after(async () => db.close());

  const { rows: executionConstraints } = await db.query(`
    SELECT pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.tenant_reminder_executions'::regclass
  `);
  assert.ok(executionConstraints.some(({ definition }) => definition.includes("UNIQUE (organization_id, id)")));
  const { rows: recipientColumn } = await db.query(`
    SELECT attnotnull FROM pg_attribute
    WHERE attrelid = 'public.tenant_reminder_executions'::regclass AND attname = 'recipient_key'
  `);
  assert.equal(recipientColumn[0]?.attnotnull, true);

  const { rows: executionNotificationConstraints } = await db.query(`
    SELECT pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.tenant_reminder_notifications'::regclass
  `);
  assert.ok(executionNotificationConstraints.some(({ definition }) =>
    definition.includes("FOREIGN KEY (organization_id, execution_id)") &&
    definition.includes("tenant_reminder_executions(organization_id, id)"),
  ));

  const { rows: appointmentReminderConstraints } = await db.query(`
    SELECT pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.tenant_appointment_reminders'::regclass
  `);
  assert.ok(appointmentReminderConstraints.some(({ definition }) => definition.includes("UNIQUE (organization_id, id)")));

  const { rows: appointmentNotificationConstraints } = await db.query(`
    SELECT pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.tenant_appointment_reminder_notifications'::regclass
  `);
  assert.ok(appointmentNotificationConstraints.some(({ definition }) =>
    definition.includes("FOREIGN KEY (organization_id, reminder_id)") &&
    definition.includes("tenant_appointment_reminders(organization_id, id)"),
  ));

  await db.exec(`
    INSERT INTO public.organizations (id) VALUES
      ('10000000-0000-0000-0000-000000000001'),
      ('20000000-0000-0000-0000-000000000002');
    INSERT INTO public.tenant_reminder_rules (id, organization_id, name, trigger_type, schedule_config)
      VALUES
      ('10000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000001','Tenant One','date','{"date":"2030-01-01"}'),
      ('20000000-0000-0000-0000-000000000022','20000000-0000-0000-0000-000000000002','Tenant Two','date','{"date":"2030-01-01"}');
    INSERT INTO public.tenant_reminder_executions (id, organization_id, rule_id, recipient_key, scheduled_for, channel)
      VALUES ('10000000-0000-0000-0000-000000000033','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011','tenant-internal','2030-01-01T00:00:00Z','internal');
    INSERT INTO public.appointments (id, organization_id, status)
      VALUES
      ('10000000-0000-0000-0000-000000000044','10000000-0000-0000-0000-000000000001','pending'),
      ('20000000-0000-0000-0000-000000000055','20000000-0000-0000-0000-000000000002','pending');
    INSERT INTO public.tenant_appointment_reminders (id, organization_id, appointment_id, reminder_offset_minutes, scheduled_for)
      VALUES ('10000000-0000-0000-0000-000000000066','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000044',120,'2030-01-01T00:00:00Z');
  `);

  await assert.rejects(
    db.query(`INSERT INTO public.tenant_reminder_executions (organization_id, rule_id, recipient_key, scheduled_for, channel)
      VALUES ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',NULL,'2030-01-01T00:00:00Z','internal')`),
    (error) => error.code === "23502",
  );
  await assert.rejects(
    db.query(`INSERT INTO public.tenant_reminder_notifications (organization_id, rule_id, execution_id, title)
      VALUES ('20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000022','10000000-0000-0000-0000-000000000033','cross-tenant')`),
    (error) => error.code === "23503",
  );
  await assert.rejects(
    db.query(`INSERT INTO public.tenant_appointment_reminder_notifications (organization_id, appointment_id, reminder_id, title)
      VALUES ('20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000055','10000000-0000-0000-0000-000000000066','cross-tenant')`),
    (error) => error.code === "23503",
  );
});
