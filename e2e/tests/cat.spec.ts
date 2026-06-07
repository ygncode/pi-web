import { test, expect, collapseScratchpad } from "../lib/test";
import {
  buildSession,
  realWorkingDir,
  uniqueSessionName,
  writeSession,
} from "../lib/sessions";

// The Cat Gatekeeper is disabled server-side for the whole suite (it would block
// input in every other test). To exercise it we enable it PAGE-LOCALLY: intercept
// the settings GET so hydration keeps it on without touching the shared server
// store, and seed localStorage for the synchronous pre-hydration read. The break
// is forced via the controller's skipToBreak() so we don't wait out the focus
// timer.

test.describe("cat gatekeeper", () => {
  test("skip-to-break shows the enforced break overlay with a countdown", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const cwd = realWorkingDir();
    const { entries } = buildSession({ cwd });
    const id = writeSession(sessionsDir, uniqueSessionName(testInfo, "cat"), entries);

    await page.route("**/api/settings", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          json: {
            settings: {
              "pi-web:v1:cat:enabled": "true",
              "pi-web:v1:cat:focus-min": "25",
              "pi-web:v1:cat:break-min": "5",
            },
          },
        });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.addInitScript(() => {
      try {
        localStorage.setItem("pi-web:v1:cat:enabled", "true");
      } catch {
        /* ignore */
      }
    });

    await collapseScratchpad(page);
    await page.goto(`/session?id=${encodeURIComponent(id)}`);

    // Wait until the controller is wired, then force the break overlay.
    await expect
      .poll(() => page.evaluate(() => typeof window.__piCatGatekeeper?.skipToBreak === "function"))
      .toBe(true);
    await page.evaluate(() => window.__piCatGatekeeper.skipToBreak());

    const overlay = page.locator("#cat-gatekeeper-overlay");
    await expect(overlay).toHaveClass(/cat-overlay--break/);
    await expect(overlay).toHaveClass(/visible/);
    await expect(overlay.locator(".cat-timer")).toHaveText(/\d\d:\d\d/);

    // Status text reflects the break phase.
    const status = await page.evaluate(() => window.__piCatGatekeeper.getStatusText());
    expect(status).toMatch(/break/i);
  });
});
