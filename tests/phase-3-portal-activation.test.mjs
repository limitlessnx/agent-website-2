import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=(p)=>fs.readFileSync(p,"utf8");

test("Post-onboarding portal surfaces WhatsApp activation safely",()=>{
  const portal=read("app/portal/page.tsx");
  assert.match(portal,/Your AI setup brief is with Fluxknight/);
  assert.match(portal,/connect the WhatsApp Business number/);
  assert.match(portal,/href="\/portal\/integrations"/);
  assert.doesNotMatch(portal,/Account SID|Auth Token|WABA|webhook/i);
});
