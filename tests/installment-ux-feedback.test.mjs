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

test("installment clients use compact expandable rows with a clear name and amount", () => {
  assert.match(page, /<details key=\{plan\.id\} className=\{\"payment-plan-card/);
  assert.match(page, /className=\"payment-plan-summary\"/);
  assert.match(page, /\{plan\.client_name\}/);
  assert.match(page, /formatNaira\(plan\.outstanding_balance\)/);
  assert.match(page, /className=\"payment-plan-details\"/);
  assert.match(css, /\.payment-plan-card\{display:block/);
  assert.match(css, /\.payment-plan-summary\{/);
});

test("installment list paginates at ten clients per page", () => {
  assert.match(page, /const PAGE_SIZE = 10/);
  assert.match(page, /plans\.slice\(pageStart, pageStart \+ PAGE_SIZE\)/);
  assert.match(page, /Page \{currentPage\} of \{pageCount\}/);
  assert.match(page, /payment-pagination/);
});

test("redundant reminder cadence and recent payment sections are not rendered on the installment page", () => {
  assert.doesNotMatch(page, /<h2>Reminder cadence<\/h2>/);
  assert.doesNotMatch(page, /<h2>Recent payments<\/h2>/);
  assert.doesNotMatch(page, /getPaymentRecords/);
});

test("newly created installment remains visibly surfaced on page one", () => {
  assert.match(page, /payment-plan-card-new/);
  assert.match(page, /payment-new-badge/);
  assert.match(page, /currentPage === 1 && index === 0/);
  assert.match(css, /\.payment-plan-card-new/);
  assert.match(css, /\.payment-new-badge/);
});


test("installment controls replicate the Fluxknight metallic/glass button system", () => {
  const globals = fs.readFileSync("app/globals.css", "utf8");
  assert.match(globals, /\.admin-button \{/);
  assert.match(globals, /linear-gradient\(110deg, #6e29d9 0%, #8b2fe5 48%, #b9438a 100%\)/);
  assert.match(globals, /backdrop-filter: blur\(16px\) saturate\(125%\)/);
  assert.match(css, /\.payment-page \.payment-status-button/);
  assert.match(css, /\.payment-page \.payment-reminder-schedule-card/);
});

test("installment layout has explicit desktop, tablet, and mobile guardrails", () => {
  assert.match(css, /@media \(max-width: 1100px\)/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /grid-template-columns: 1fr/);
  assert.match(css, /grid-template-columns: minmax\(0,1fr\) auto 24px/);
});
