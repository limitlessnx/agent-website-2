import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("global action button contract supports semantic loading labels and in-place pending state", () => {
  const button = read("components/Button.tsx");

  assert.match(button, /loading|pending/i, "Button must expose a loading/pending state");
  assert.match(button, /Saving|Creating|Updating|Deleting|Sending|Processing/i, "Button system must support semantic action labels");
  assert.match(button, /aria-busy/, "Pending actions must expose aria-busy");
  assert.match(button, /disabled/, "Pending actions must prevent duplicate submissions");
});

test("global action button contract preserves dimensions while loading", () => {
  const button = read("components/Button.tsx");

  assert.match(button, /minWidth|min-width|width/, "Button must reserve stable geometry");
  assert.match(button, /spinner|loadingIndicator|Loader|Loader2/i, "Loading state must have a visual indicator");
  assert.match(button, /whiteSpace|white-space/, "Action labels must not cause avoidable layout shifts");
});

test("global dashboard visual system defines shared action geometry", () => {
  const css = read("app/dashboard-visual-system.css");
  assert.match(css, /button|\.btn|\.action/i);
  assert.match(css, /min-height|height/i);
  assert.match(css, /border-radius/i);
  assert.match(css, /gap/i);
});

test("global dashboard visual system defines a restrained premium accent instead of saturated legacy CTA treatment", () => {
  const css = read("app/dashboard-visual-system.css");
  assert.match(css, /--fk-/);
  assert.match(css, /purple|violet|lavender|accent/i);
  assert.doesNotMatch(css, /#00d4ff|rgb\(0\s*,\s*212\s*,\s*255\)/i);
});

test("dashboard action buttons have consistent size tiers", () => {
  const button = read("components/Button.tsx");
  assert.match(button, /sm/);
  assert.match(button, /md/);
  assert.match(button, /lg/);
  assert.match(button, /padding/);
  assert.match(button, /borderRadius|border-radius/);
});

test("payment actions use semantic action-specific pending labels", () => {
  const submit = read("app/dashboard/limitless/payments/PaymentSubmitButton.tsx");
  const records = read("app/dashboard/limitless/payments/PaymentRecordActions.tsx");

  assert.match(submit, /Saving|Creating|Recording|Processing/i);
  assert.match(records, /Saving|Deleting|Updating|Recording|Processing/i);
  assert.match(submit, /aria-busy/);
  assert.match(records, /aria-busy/);
});

test("destructive actions retain confirmation and expose a pending state", () => {
  const deleteButton = read("app/dashboard/limitless/properties/DeletePropertyButton.tsx");
  assert.match(deleteButton, /confirm/);
  assert.match(deleteButton, /pending/);
  assert.match(deleteButton, /Deleting/);
});

test("dashboard UI changes preserve reduced-motion accessibility", () => {
  const css = read("components/admin/DashboardReferenceFidelity.module.css");
  assert.match(css, /prefers-reduced-motion/);
});

test("global UI implementation must avoid page navigation for ordinary in-place mutations", () => {
  const button = read("components/Button.tsx");
  assert.doesNotMatch(button, /window\.location|location\.href/);
  assert.match(button, /onClick|type/);
});

test("global action feedback is designed for every mutation class", () => {
  const button = read("components/Button.tsx");
  for (const verb of ["Saving", "Creating", "Updating", "Deleting", "Sending", "Recording", "Approving", "Rejecting", "Uploading", "Connecting", "Testing", "Running"]) {
    assert.match(button, new RegExp(verb), `Missing semantic action state: ${verb}`);
  }
});


test("loading navigation actions cannot activate their href while busy", () => {
  const button = read("components/Button.tsx");
  assert.match(button, /isBusy.*preventDefault|preventDefault.*isBusy/s, "Busy links must block navigation activation");
  assert.match(button, /aria-disabled={isBusy/, "Busy links must expose disabled semantics");
});

test("dashboard visual system applies shared control geometry beyond the new Button component", () => {
  const css = read("app/dashboard-visual-system.css");
  assert.match(css, /\\[data-dashboard-theme\\] button/);
  assert.match(css, /portal-button/);
  assert.match(css, /border-radius:var\\(--fk-radius-control/);
});
