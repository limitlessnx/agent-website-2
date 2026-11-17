import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const secret = "synthetic-local-test-secret";
const screenshotStyle = "nextjs-portal { display:none !important; }";
const tenants = [
  ["general", "Demo Business"],
  ["real-estate", "Demo Realty"],
  ["photography-studio", "Demo Studio"],
  ["hotels", "Demo Hotel"],
] as const;
function token(payload: Record<string, unknown>) {
  const value = Buffer.from(
    JSON.stringify({ ...payload, issuedAt: Date.now() }),
  ).toString("base64url");
  return `${value}.${createHmac("sha256", secret).update(value).digest("base64url")}`;
}
test.beforeEach(async ({ context }) => {
  await context.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:4400") return route.abort();
    if (!["GET", "HEAD"].includes(request.method())) return route.abort();
    return route.continue();
  });
});
async function audit(
  page: import("@playwright/test").Page,
  testInfo: import("@playwright/test").TestInfo,
) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  });
  const logoIds = await page
    .locator('svg[aria-label="Fluxknight"] defs [id]')
    .evaluateAll((elements) => elements.map((element) => element.id));
  expect(
    new Set(logoIds).size,
    "Logo paint definitions must be unique across responsive shells.",
  ).toBe(logoIds.length);
  const layout = await page.evaluate(() => ({
    viewport: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    overflowing: [
      ...document.querySelectorAll(
        ":is(.portal-main,.admin-main) :is(button,input,h1,h2,a)",
      ),
    ]
      .filter((el) => {
        if (
          el.closest(
            'aside,nav,[aria-hidden="true"],[hidden],.admin-sidebar,.portal-sidebar',
          ) ||
          !el.checkVisibility({ visibilityProperty: true })
        )
          return false;
        // Nested scrolling regions are intentional (catalogue rails and data tables).
        // The document overflow assertion still catches uncontained page overflow.
        for (
          let parent = el.parentElement;
          parent;
          parent = parent.parentElement
        ) {
          if (
            ["auto", "scroll"].includes(getComputedStyle(parent).overflowX) &&
            parent.scrollWidth > parent.clientWidth
          )
            return false;
        }
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return (
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          rect.width > 0 &&
          (rect.right > innerWidth + 1 || rect.left < -1)
        );
      })
      .slice(0, 12)
      .map((el) => ({ tag: el.tagName, text: el.textContent?.slice(0, 100) })),
  }));
  await testInfo.attach("layout-audit", {
    body: JSON.stringify(layout, null, 2),
    contentType: "application/json",
  });
  await testInfo.attach("viewport", {
    body: await page.screenshot({
      fullPage: true,
      animations: "disabled",
      style: screenshotStyle,
    }),
    contentType: "image/png",
  });
  if (process.env.FLUX_VISUAL_COMPARE === "1") {
    const review = JSON.parse(
      readFileSync(
        join(process.cwd(), "tests/responsive/visual-review.json"),
        "utf8",
      ),
    );
    expect(
      review.status,
      "Visual baselines must have a recorded implementation review.",
    ).toBe("reviewed");
    const name = `${testInfo.title.replace(/[^a-z0-9]+/gi, "-").replace(/-$/, "")}-${testInfo.project.name}.png`;
    await expect(page).toHaveScreenshot(name, {
      fullPage: true,
      animations: "disabled",
      stylePath: join(process.cwd(), "tests/responsive/visual-stability.css"),
      maxDiffPixelRatio: 0.002,
    });
  }
  // Captures are audit evidence, never silently blessed as visual baselines.
  expect(
    layout.documentWidth,
    "Page-level horizontal overflow",
  ).toBeLessThanOrEqual(layout.viewport + 1);
  expect(layout.overflowing, "Primary content crosses the viewport").toEqual(
    [],
  );
}
for (const route of ["/dashboard", "/dashboard/clients"]) {
  test(`admin ${route}`, async ({ page, context }, testInfo) => {
    await context.addCookies([
      {
        name: "limitless_admin_session",
        value: token({ email: "admin@example.test", name: "Synthetic Admin" }),
        url: "http://127.0.0.1:4400",
      },
    ]);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(route, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe(route);
    await expect(page.locator("#dashboard-theme-root")).toBeVisible();
    await audit(page, testInfo);
    expect(errors).toEqual([]);
    const menu = page.getByRole("button", {
      name: "Open navigation menu",
      exact: true,
    });
    if (await menu.isVisible()) {
      await menu.click();
      await expect(
        page.getByRole("dialog", { name: "Admin navigation" }),
      ).toBeVisible();
      await testInfo.attach("mobile-navigation", {
        body: await page.screenshot({
          animations: "disabled",
          style: screenshotStyle,
        }),
        contentType: "image/png",
      });
      await page.keyboard.press("Escape");
      await expect(menu).toBeFocused();
    }
  });
}
for (const [index, [industry, name]] of tenants.entries()) {
  test(`tenant ${industry}`, async ({ page, context }, testInfo) => {
    await context.addCookies([
      {
        name: "fluxknight_client_session",
        value: token({
          userId: "qa-owner",
          email: "owner@example.test",
          organizationId: `10000000-0000-4000-8000-00000000000${index + 1}`,
          organizationSlug: `qa-${industry}`,
          membershipId: "qa-membership",
          role: "owner",
        }),
        url: "http://127.0.0.1:4400",
      },
    ]);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto("/portal", { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe("/portal");
    await expect(page.locator(".portal-main")).toBeVisible();
    await expect(page.locator(".portal-topbar")).toContainText(name);
    if (industry === "hotels") {
      await expect(
        page.getByRole("dialog", { name: "Welcome to your hotel workspace" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Skip tour", exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "The hotel overview could not be loaded",
        }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "New reservation", exact: true }),
      ).toBeVisible();
    }
    await audit(page, testInfo);
    expect(errors).toEqual([]);
    const open =
      industry === "hotels"
        ? page.getByRole("button", {
            name: "More hotel navigation",
            exact: true,
          })
        : page.getByRole("button", {
            name: "Open client dashboard navigation",
            exact: true,
          });
    if (await open.isVisible()) {
      await open.click();
      await expect(page.locator(".portal-sidebar")).toHaveClass(/is-open/);
      await page.keyboard.press("Tab");
      expect(
        await page
          .locator(".portal-sidebar")
          .evaluate((el) => el.contains(document.activeElement)),
      ).toBe(true);
      await testInfo.attach("mobile-navigation", {
        body: await page.screenshot({
          animations: "disabled",
          style: screenshotStyle,
        }),
        contentType: "image/png",
      });
      const settings = page
        .getByRole("navigation", { name: "Client dashboard navigation" })
        .getByRole("link", { name: "Settings", exact: true });
      await settings.focus();
      const settingsBox = await settings.boundingBox();
      expect(settingsBox!.y + settingsBox!.height).toBeLessThanOrEqual(
        page.viewportSize()!.height + 1,
      );
      await page.keyboard.press("Escape");
      await expect(page.locator(".portal-sidebar")).not.toHaveClass(/is-open/);
      await expect(open).toBeFocused();
    }
  });
}

test("shared component states and keyboard interactions", async ({
  page,
  context,
}, testInfo) => {
  await context.addCookies([
    {
      name: "limitless_admin_session",
      value: token({ email: "admin@example.test", name: "Synthetic Admin" }),
      url: "http://127.0.0.1:4400",
    },
  ]);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/dashboard/design-system", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", {
      name: "Fluxknight design system",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Check example form" }).click();
  await expect(page.getByLabel("Example organization name")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("Example organization name").fill("Synthetic Studio");
  await page.getByRole("button", { name: "Check example form" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Local form check complete." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Unavailable", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
  const saveExample = page.getByRole("button", {
    name: "Save example",
    exact: true,
  });
  const before = await saveExample.boundingBox();
  await page.getByRole("button", { name: "Toggle example loading" }).click();
  const after = await page
    .getByRole("button", { name: "Saving example…", exact: true })
    .boundingBox();
  expect(after?.width).toBe(before?.width);
  expect(after?.height).toBe(before?.height);
  await page.getByRole("button", { name: "Toggle example loading" }).click();
  const dialogTrigger = page.getByRole("button", {
    name: "Open dialog",
    exact: true,
  });
  await dialogTrigger.click();
  await expect(
    page.getByRole("dialog", { name: "Example dialog" }),
  ).toBeVisible();
  await testInfo.attach("dialog", {
    body: await page.screenshot({
      animations: "disabled",
      style: screenshotStyle,
    }),
    contentType: "image/png",
  });
  for (let index = 0; index < 4; index++) {
    await page.keyboard.press("Tab");
    expect(
      await page
        .getByRole("dialog", { name: "Example dialog" })
        .evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Example dialog" }),
  ).not.toBeVisible();
  await expect(dialogTrigger).toBeFocused();
  const drawerTrigger = page.getByRole("button", {
    name: "Open drawer",
    exact: true,
  });
  await drawerTrigger.click();
  await expect(
    page.getByRole("dialog", { name: "Example drawer" }),
  ).toBeVisible();
  await testInfo.attach("drawer", {
    body: await page.screenshot({
      animations: "disabled",
      style: screenshotStyle,
    }),
    contentType: "image/png",
  });
  await page.keyboard.press("Escape");
  await expect(drawerTrigger).toBeFocused();
  await page.getByRole("tab", { name: "Table", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Empty state", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("heading", { name: "No test results yet" }),
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("status", { name: "Loading example cards" }),
  ).toBeVisible();
  await page.keyboard.press("Home");
  await expect(
    page.getByRole("region", { name: "Synthetic organizations" }),
  ).toBeVisible();
  await page.getByText("More actions", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "View example details" }),
  ).toBeVisible();
  const menuBox = await page
    .getByRole("button", { name: "View example details" })
    .boundingBox();
  expect(menuBox!.x).toBeGreaterThanOrEqual(0);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "View example details" }),
  ).not.toBeVisible();
  await audit(page, testInfo);
  expect(errors).toEqual([]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const duration = await dialogTrigger.evaluate(
    (el) => getComputedStyle(el).transitionDuration,
  );
  expect(
    duration.split(",").every((value) => parseFloat(value) <= 0.00001),
  ).toBe(true);
});
