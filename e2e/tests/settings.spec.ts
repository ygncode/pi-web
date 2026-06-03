import { test, expect } from "../lib/test";

const LAYOUT = '[data-setting="pi-sessions:view-layout"]';
// Isolated setting that nothing else asserts on, so the round-trip can mutate
// shared server-side state without affecting other specs.
const SPINNER = '[data-setting="pi-sessions:spinner-style"]';

test.describe("settings page", () => {
  test("loads with controls", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator(LAYOUT)).toBeVisible();
  });

  // Settings persist in one global server-side store; running this on all 7
  // projects in parallel would race on the same key. Persistence is
  // browser-independent, so verify it on a single project.
  test("persists a setting server-side across reload", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "Desktop Chrome",
      "server-side persistence is browser-independent; run once",
    );

    await page.goto("/settings");
    const select = page.locator(SPINNER);
    await expect(select).toBeVisible();

    const current = await select.inputValue();
    const next = current === "runcat" ? "braille" : "runcat";

    // Changing the control writes through to the server via POST /api/settings.
    const saved = page.waitForResponse(
      (r) => r.url().includes("/api/settings") && r.request().method() === "POST",
    );
    await select.selectOption(next);
    await saved;

    // Drop the local cache so the reloaded value can only come from the server.
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    await expect(page.locator(SPINNER)).toHaveValue(next);
  });
});
