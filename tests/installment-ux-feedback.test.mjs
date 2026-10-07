import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/dashboard/limitless/payments/installments/page.tsx", "utf8");
const actions = fs.readFileSync("app/dashboard/limitless/payments/actions.ts", "utf8");
const css = fs.readFileSync("app/dashboard/limitless/payments/payments.css", "utf8");

test("installment creation gives explicit success feedback and refreshes the installment list", () => {
  assert.match(actions, /revalidatePath\(\"\/dashboard\/limitless\/payments\/installments\"\)/);
  assert.match(actions, /redirect\(\"\/dashboard\/limitless\/payments\/installments\?success=installment-created\"\)/);
  assert.match(page, /Installment created successfully/);
  assert.match(page, /aria-live=\"polite\"/);
});

test("newly created installment is visibly surfaced in the installment list", () => {
  assert.match(page, /Installment clients <span className=\"payment-count-badge\">\{plans\.length\}<\/span>/);
  assert.match(page, /payment-plan-card-new/);
  assert.match(page, /payment-new-badge/);
  assert.match(page, /plans\.map\(\(plan, index\)/);
  assert.match(css, /\.payment-plan-card-new/);
  assert.match(css, /\.payment-new-badge/);
});
