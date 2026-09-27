import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

function triggerFiles(){
  return readdirSync("src/trigger").filter((name)=>name.endsWith(".ts")||name.endsWith(".tsx")).map((name)=>path.join("src/trigger",name));
}

test("automatic Trigger schedules are intentionally paused during tenant onboarding buildout",()=>{
  const files=triggerFiles();
  const scheduled=[];
  for(const file of files){
    const source=readFileSync(file,"utf8");
    if(source.includes("schedules.task(")) scheduled.push(file);
  }
  assert.deepEqual(scheduled,[]);
});

test("core operational jobs remain callable on demand while automatic schedules are paused",()=>{
  const trigger=readFileSync("src/trigger/system-orchestrator.ts","utf8");
  for(const id of [
    "system-event-drain",
    "appointment-reminder-drain",
    "orchestration-recovery-sweep",
    "handoff-followup-drain",
    "platform-hourly-maintenance-sweep",
  ]){
    assert.match(trigger,new RegExp('id: "'+id+'"'));
  }
  assert.match(trigger,/processSystemEvent/);
  assert.match(trigger,/processDueAppointmentReminders/);
  assert.match(trigger,/recoverFailedSystemEvents/);
  assert.match(trigger,/processDueHandoffFollowups/);
  assert.match(trigger,/scanAnalyticsAnomalies/);
  assert.match(trigger,/syncDueFluxSubscriptionWallets/);
});

test("Flux Social keeps direct tasks but no automatic generation analytics planning or publishing crons",()=>{
  const generation=readFileSync("src/trigger/social-generation-worker.tsx","utf8");
  const analytics=readFileSync("src/trigger/social-meta-analytics.ts","utf8");
  const weekly=readFileSync("src/trigger/social-weekly-cycle.ts","utf8");
  const publisher=readFileSync("src/trigger/social-publisher.ts","utf8");
  assert.match(generation,/id: "flux-social-generation-worker"/);
  assert.match(analytics,/id: "flux-social-meta-analytics"/);
  assert.match(weekly,/id: "flux-social-weekly-cycle"/);
  assert.match(publisher,/id: "flux-social-publish-post"/);
  assert.doesNotMatch(generation,/flux-social-generation-sweeper/);
  assert.doesNotMatch(analytics,/flux-social-meta-analytics-schedule/);
  assert.doesNotMatch(weekly,/flux-social-weekly-planner/);
  assert.doesNotMatch(publisher,/flux-social-scheduler/);
});
