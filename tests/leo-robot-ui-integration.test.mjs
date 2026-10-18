import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const component = await readFile(new URL("../components/leo/LeoRobot.tsx", import.meta.url), "utf8");
const client = await readFile(new URL("../app/dashboard/support/AgentLeoClient.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/dashboard/support/support.css", import.meta.url), "utf8");

test("Leo robot is a reusable accessible inline SVG component", () => {
  assert.ok(component.includes("export default function LeoRobot"));
  assert.ok(component.includes("<svg"));
  assert.ok(component.includes('viewBox="0 0 360 404"'));
  assert.ok(component.includes("aria-label={label}"));
  assert.ok(component.toLowerCase().includes("#b34dff"));
});

test("Super Admin support workspace renders Leo robot without replacing chat behavior", () => {
  assert.ok(client.includes('import LeoRobot from "@/components/leo/LeoRobot";'));
  assert.ok(client.includes('<LeoRobot size={220} className="leo-robot-art" />'));
  assert.ok(client.includes('<LeoRealtimeVoice sessionId={conversationId || undefined} />'));
  assert.ok(client.includes("async function submit("));
  assert.ok(client.includes("async function decideAction("));
});

test("Leo robot styling supports thinking state, mobile layout, and reduced motion", () => {
  assert.ok(styles.includes(".leo-robot-stage.thinking"));
  assert.ok(styles.includes("@media(max-width:760px)"));
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.ok(styles.includes(".leo-robot-halo"));
});

test("Leo robot integration remains presentational and does not auto-run actions", () => {
  assert.doesNotMatch(component, /fetch\s*\(/);
  assert.doesNotMatch(component, /window\./);
  assert.ok(client.includes('onClick={() => decideAction(action, "approve")}'));
  assert.ok(client.includes("Sensitive production actions still require your approval"));
});
