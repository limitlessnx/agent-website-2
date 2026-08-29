import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../lib/leo-business-simulation.ts", import.meta.url), "utf8");

test("business simulation is explicitly not prediction", () => {
  assert.match(source, /Simulation is scenario analysis, not prediction/i);
  assert.match(source, /Missing historical evidence produces unknown\/low-confidence impact rather than fabricated percentages/i);
});

test("business simulation cannot execute or self approve", () => {
  assert.match(source, /Simulation cannot mutate configuration, approve itself, or execute a consequential action/i);
  assert.match(source, /canonical Leo approval and evidence verification/i);
});

test("business simulation protects financial integrity and workspace isolation", () => {
  assert.match(source, /Never invent revenue, conversion, ROI, closing volume or financial effects/i);
  assert.match(source, /one exact organization ID/i);
  assert.match(source, /private records are never blended/i);
});

test("unmapped parameters return insufficient evidence instead of invented outcomes", () => {
  assert.match(source, /insufficient historical evidence to infer a reliable outcome direction/i);
  assert.match(source, /insufficient_evidence/i);
});
