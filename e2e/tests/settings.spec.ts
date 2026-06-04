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

  // Alignment: all form controls in the settings control column must share the
  // same rendered width so the column has consistent left and right edges.
  test("form controls share a uniform width", async ({ page }, testInfo) => {
    // Run only on Desktop Chrome — layout is visual, browser-independent, and
    // a single representative viewport (1280×720) is enough.
    test.skip(
      testInfo.project.name !== "Desktop Chrome",
      "visual alignment check runs on one project",
    );

    await page.goto("/settings");
    await expect(page.locator(LAYOUT)).toBeVisible();

    // Collect bounding-box widths of every select, number, and time input that
    // sits inside a .settings-control.
    const widths: number[] = await page.evaluate(() => {
      const controls = document.querySelectorAll<HTMLElement>(
        ".settings-control select, .settings-control input[type='number'], .settings-control input[type='time']",
      );
      return Array.from(controls).map((el) =>
        Math.round(el.getBoundingClientRect().width),
      );
    });

    expect(widths.length).toBeGreaterThan(0);

    // All controls must be the same width (uniform column).
    const first = widths[0];
    for (const w of widths) {
      expect(w).toBe(first);
    }
  });

  // Alignment: on narrow viewports (≤560px) rows must stack vertically so the
  // label and control don't compete for horizontal space.
  test("rows stack vertically on narrow viewports", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "Desktop Chrome",
      "responsive stacking check runs on one project",
    );

    await page.setViewportSize({ width: 400, height: 800 });
    await page.goto("/settings");
    await expect(page.locator(LAYOUT)).toBeVisible();

    const flexDirection = await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>(".settings-row");
      return row ? getComputedStyle(row).flexDirection : null;
    });

    expect(flexDirection).toBe("column");
  });
});
