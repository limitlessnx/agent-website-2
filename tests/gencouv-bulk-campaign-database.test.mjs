import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(
  new URL("../supabase/migrations/20261120040000_gencouv_resend_bulk_campaigns.sql", import.meta.url),
  "utf8"
);
const org = "10000000-0000-4000-8000-000000000001";
const otherOrg = "10000000-0000-4000-8000-000000000002";
const campaign = "20000000-0000-4000-8000-000000000001";
const otherCampaign = "20000000-0000-4000-8000-000000000002";
async function fixture(t) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.organizations(id uuid primary key);
    create table public.crm_customers(
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id),
      email text,
      status text not null default 'active',
      metadata jsonb not null default '{"source":"gencouv_document_import","marketing_consent":"unknown"}'::jsonb,
      unique(id, organization_id)
    );
    insert into organizations values ('${org}'), ('${otherOrg}');
    create table public.gencouv_suppression_list(
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id),
      normalized_email text not null,
      unique(organization_id,normalized_email)
    );
    insert into crm_customers(organization_id,email)
      select '${org}', 'contact'||i||'@example.com' from generate_series(1,115) i;
    insert into crm_customers(organization_id,email)
      values ('${otherOrg}', 'other@example.com');
  `);
  await db.exec(migration);
  await db.exec(`
    insert into gencouv_bulk_campaigns(
      id,organization_id,from_email,subject,text_body,status,
      consent_confirmed,consent_basis,consent_confirmed_at,consent_confirmed_by
    ) values
    ('${campaign}','${org}','info@gencouv.com','Campaign','Hello','ready',true,'Recorded form permission',now(),'admin@example.com'),
    ('${otherCampaign}','${otherOrg}','info@gencouv.com','Campaign 2','Hello','ready',true,'Recorded form permission',now(),'admin@example.com');
    insert into gencouv_bulk_recipients(campaign_id,organization_id,customer_id,normalized_email)
      select '${campaign}', '${org}', id,
        'contact' || row_number() over (order by id) || '@example.com'
      from crm_customers where organization_id='${org}';
  `);
  return db;
}
test("migration applies and the first batch reserves 100 distinct recipients", async t => {
  const db = await fixture(t);
  const { rows } = await db.query(
    "select id,status from gencouv_claim_bulk_batch($1,$2,$3)",
    [org,campaign,100]
  );
  assert.equal(rows.length,100);
  assert.ok(rows.every(r=>r.status==="sending"));
  assert.equal(new Set(rows.map(r=>r.id)).size,100);
  const second = await db.query("select id from gencouv_claim_bulk_batch($1,$2,$3)",[org,campaign,10]);
  assert.equal(second.rows.length,0);
  assert.equal(new Set([...rows,...second.rows].map(r=>r.id)).size,100);
});
test("tenant cross-write is rejected by composite foreign keys", async t => {
  const db = await fixture(t);
  const outsider = (await db.query("select id from crm_customers where organization_id=$1",[otherOrg])).rows[0].id;
  await assert.rejects(
    db.query("insert into gencouv_bulk_recipients(campaign_id,organization_id,customer_id,normalized_email) values ($1,$2,$3,$4)",
      [campaign,org,outsider,"outsider@example.com"]),
    /foreign key/i
  );
});
test("unique campaign/email prevents double reservation", async t => {
  const db=await fixture(t);
  const customer=(await db.query("select id from crm_customers where organization_id=$1 limit 1",[org])).rows[0].id;
  await assert.rejects(db.query(
    "insert into gencouv_bulk_recipients(campaign_id,organization_id,customer_id,normalized_email) values ($1,$2,$3,$4)",
    [campaign,org,customer,"contact1@example.com"]
  ),/unique/i);
});
test("account-day cap returns no more than 100 claims in total",async t=>{
  const db=await fixture(t);
  let claimed=0;
  for(let i=0;i<11;i++){
    const batch=await db.query("select id from gencouv_claim_bulk_batch($1,$2,$3)",[org,campaign,10]);
    claimed+=batch.rows.length;
  }
  assert.equal(claimed,100);
  const further=await db.query("select id from gencouv_claim_bulk_batch($1,$2,$3)",[org,campaign,10]);
  assert.equal(further.rows.length,0);
});

test("individual imported-contact opt-in creates an atomic audit record", async t => {
  const db = await fixture(t);
  const contact = (await db.query("select id from crm_customers where organization_id=$1 limit 1",[org])).rows[0].id;
  const { rows } = await db.query(
    "select gencouv_record_imported_contact_consent($1,$2,$3,$4,$5) as ok",
    [org, contact, true, "Signup form recorded on 2026-11-01", "admin@gencouv.com"]
  );
  assert.equal(rows[0].ok,true);
  const update = await db.query("select metadata from crm_customers where id=$1",[contact]);
  assert.equal(update.rows[0].metadata.marketing_consent,"granted");
  assert.match(update.rows[0].metadata.marketing_consent_source,/Signup form/);
  const audit = await db.query("select decision,confirmed_by from gencouv_contact_consent_audit where customer_id=$1",[contact]);
  assert.equal(audit.rows.length,1);
  assert.equal(audit.rows[0].decision,"granted");
  assert.equal(audit.rows[0].confirmed_by,"admin@gencouv.com");
});
test("suppressed imported contacts cannot be marked as consented",async t=>{
  const db = await fixture(t);
  const contact = (await db.query("select id,email from crm_customers where organization_id=$1 limit 1",[org])).rows[0];
  await db.query("insert into gencouv_suppression_list(organization_id,normalized_email) values ($1,$2)",[org,contact.email]);
  await assert.rejects(db.query(
    "select gencouv_record_imported_contact_consent($1,$2,$3,$4,$5)",
    [org,contact.id,true,"Previously documented form","admin@gencouv.com"]
  ),/Suppressed contact/i);
});
