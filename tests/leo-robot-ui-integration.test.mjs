import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const component = await readFile(new URL("../components/leo/LeoRobot.tsx", import.meta.url), "utf8");
const client = await readFile(new URL("../app/dashboard/support/AgentLeoClient.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/dashboard/support/support.css", import.meta.url), "utf8");

test("Leo robot is a reusable accessible inline SVG component", () => {
  assert.match(component, /export default function LeoRobot/);
  assert.match(component, /<svg/);
  assert.match(component, /viewBox="0 0 360 404"/);
  assert.match(component, /aria-label=\{label\}/);
  assert.match(component, /#b34dff/i);
});

test("Super Admin support workspace renders Leo robot without replacing chat behavior", () => {
  assert.match(client, /import LeoRobot from "@\/components\/leo\/LeoRobot"/);
  assert.match(client, /<LeoRobot size=\{220\} className="leo-robot-art" \/>/);
  assert.match(client, /<LeoRealtimeVoice sessionId=\{conversationId \|\| undefined\} \/>/);
  assert.match(client, /async function submit\(/);
  assert.match(client, /async function decideAction\(/);
});

test("Leo robot styling supports thinking state, mobile layout, and reduced motion", () => {
  assert.match(styles, /\.leo-robot-stage\.thinking/);
  assert.match(styles, /@media\(max-width:760px\)/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /\.leo-robot-halo/);
});

test("Leo robot integration remains presentational and does not auto-run actions", () => {
  assert.doesNotMatch(component, /fetch\s*\(/);
  assert.doesNotMatch(component, /window\./);
  assert.match(client, /onClick=\{\(\) => decideAction\(action, "approve"\)\}/);
  assert.match(client, /Sensitive production actions still require your approval/);
});
