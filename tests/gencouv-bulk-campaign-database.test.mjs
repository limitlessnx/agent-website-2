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
      unique(id, organization_id)
    );
    insert into organizations values ('${org}'), ('${otherOrg}');
    insert into crm_customers(organization_id)
      select '${org}' from generate_series(1,115);
    insert into crm_customers(organization_id) values ('${otherOrg}');
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
  assert.equal(new Set(rows.map(r=>r.id)).size,10);
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
  for(let i=0;i<9;i++){
    const batch=await db.query("select id from gencouv_claim_bulk_batch($1,$2,$3)",[org,campaign,10]);
    claimed+=batch.rows.length;
  }
  assert.equal(claimed,100);
  const further=await db.query("select id from gencouv_claim_bulk_batch($1,$2,$3)",[org,campaign,10]);
  assert.equal(further.rows.length,0);
});
