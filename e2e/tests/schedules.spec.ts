import { test, expect } from "../lib/test";
import { realWorkingDir } from "../lib/sessions";

// Schedules auto-create pi sessions on a cadence (or via Run-now). These specs
// drive the /schedules UI against the stub `pi` worker (e2e/lib/stub-pi/pi):
// creating a schedule, firing it on demand, reading the run log, and deleting.
//
// Schedule state lives in the shared server SQLite DB, and all 7 Playwright
// projects hit one server, so every schedule is created with a unique name and
// located by that name to stay isolated across parallel runs.

function uniqueName(testInfo: import("@playwright/test").TestInfo): string {
  const proj = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-");
  return `e2e sched ${proj} w${testInfo.workerIndex} ${Date.now()}`;
}

// The "new schedule" entry point is responsive: a header button on desktop, a
// floating + on mobile (where the header button is hidden). Click whichever is
// visible so the spec runs across every project's viewport.
async function openCreateEditor(page: import("@playwright/test").Page) {
  const header = page.locator('[data-testid="schedule-new"]');
  if (await header.isVisible()) {
    await header.click();
  } else {
    await page.locator('[data-testid="schedule-new-fab"]').click();
  }
}

test.describe("schedules (stubbed pi)", () => {
  test("nav button opens the schedules page", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-schedules-btn]").click();
    await expect(page).toHaveURL(/\/schedules$/);
    // A create entry point is present (header button on desktop, floating + on
    // mobile).
    const header = page.locator('[data-testid="schedule-new"]');
    const fab = page.locator('[data-testid="schedule-new-fab"]');
    expect((await header.isVisible()) || (await fab.isVisible())).toBe(true);

    // Guard against the styling regression where the page rendered unstyled:
    // the schedules stylesheet must be inlined into the SPA shell. A plain div
    // has max-width "none"; .schedules-page sets it to 880px.
    const maxWidth = await page
      .locator(".schedules-page")
      .evaluate((el) => getComputedStyle(el).maxWidth);
    expect(maxWidth).toBe("880px");
  });

  test("create, run now, view run log, and delete a schedule", async ({
    page,
  }, testInfo) => {
    const name = uniqueName(testInfo);
    // A real cwd so the created session has chat available (not "view only").
    const project = realWorkingDir();

    await page.goto("/schedules");

    // Create a manual schedule.
    await openCreateEditor(page);
    await page.locator('[data-testid="schedule-name"]').fill(name);
    await page
      .locator('[data-testid="schedule-instructions"]')
      .fill("Run the scheduled job");
    await page.locator('[data-testid="schedule-project"]').fill(project);
    await page
      .locator('[data-testid="schedule-frequency"]')
      .selectOption("manual");
    await page.locator('[data-testid="schedule-save"]').click();

    const card = page
      .locator('[data-testid="schedule-card"]')
      .filter({ hasText: name });
    await expect(card).toBeVisible();

    // Run-now fires immediately and navigates to the freshly created session.
    await card.locator('[data-testid="schedule-run"]').click();
    await expect(page).toHaveURL(/\/session\?id=/, { timeout: 15000 });

    // Back to the list, open the run log: a run is recorded and links to its
    // session.
    await page.goto("/schedules");
    const card2 = page
      .locator('[data-testid="schedule-card"]')
      .filter({ hasText: name });
    await card2.locator('[data-testid="schedule-runs"]').click();
    await expect(card2.locator('[data-testid="run-row"]')).toHaveCount(1);
    await expect(card2.locator('[data-testid="run-open"]')).toBeVisible();

    // The run-log link navigates back into the created session.
    await card2.locator('[data-testid="run-open"]').click();
    await expect(page).toHaveURL(/\/session\?id=/, { timeout: 15000 });

    // Delete it (confirm() is auto-accepted).
    await page.goto("/schedules");
    page.on("dialog", (dialog) => dialog.accept());
    const card3 = page
      .locator('[data-testid="schedule-card"]')
      .filter({ hasText: name });
    await card3.locator('[data-testid="schedule-delete"]').click();
    await expect(
      page.locator('[data-testid="schedule-card"]').filter({ hasText: name }),
    ).toHaveCount(0);
  });

  test("preset frequency shows a next-run time", async ({ page }, testInfo) => {
    const name = uniqueName(testInfo) + " daily";

    await page.goto("/schedules");
    await openCreateEditor(page);
    await page.locator('[data-testid="schedule-name"]').fill(name);
    await page
      .locator('[data-testid="schedule-instructions"]')
      .fill("Daily digest");
    await page.locator('[data-testid="schedule-frequency"]').selectOption("daily");
    await page.locator('[data-testid="schedule-save"]').click();

    const card = page
      .locator('[data-testid="schedule-card"]')
      .filter({ hasText: name });
    await expect(card).toBeVisible();
    // A cron schedule reports a computed next run in its meta line (default
    // locale is English in e2e).
    await expect(card).toContainText("Next");

    // Cleanup so the shared list doesn't accumulate across runs.
    await page.goto("/schedules");
    page.on("dialog", (dialog) => dialog.accept());
    await page
      .locator('[data-testid="schedule-card"]')
      .filter({ hasText: name })
      .locator('[data-testid="schedule-delete"]')
      .click();
  });
});
