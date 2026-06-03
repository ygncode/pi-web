import { test, expect } from "../lib/test";

// The "Check for updates" affordance must not flash: while a check is in
// flight the button itself shows an inline spinner + "Checking…", and the
// separate status row stays hidden so the modal layout never jumps.
test.describe("version modal update check", () => {
  test("shows an inline loading state without a layout-jumping status row", async ({
    page,
  }, testInfo) => {
    // Timing/visual behavior is browser-independent — run on one project.
    test.skip(
      testInfo.project.name !== "Desktop Chrome",
      "loading-state check runs on one project",
    );

    // Pin the initial version state to "up to date" so the modal deterministically
    // opens on the "Check for updates" affordance. Without this the state depends
    // on the binary's build version and a background update check (in CI the
    // binary is stamped with a bare commit SHA, which isn't treated as a dev
    // build, so the poller reports an update and the modal shows "Update &
    // Restart" instead).
    await page.route("**/api/version", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          current: "1.0.0",
          latest: "1.0.0",
          hasUpdate: false,
          isDev: false,
          checkedAt: new Date().toISOString(),
        }),
      });
    });

    // Control the check timing and avoid a real GitHub round-trip: hold the
    // response open long enough to observe the in-flight state, then resolve
    // as "up to date".
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/check-update", async (route) => {
      await gate;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          current: "1.0.0",
          latest: "1.0.0",
          hasUpdate: false,
          checkedAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto("/");

    // Open the index menu and the version modal.
    await page.locator("#web-menu-btn").click();
    await page.locator("#index-version-row").click();

    const overlay = page.locator(".version-modal-overlay.open");
    await expect(overlay).toBeVisible();

    const checkBtn = overlay.locator(".version-modal-btn", {
      hasText: "Check for updates",
    });
    await expect(checkBtn).toBeVisible();

    // Click the check; the response is gated, so we're now in the in-flight state.
    await checkBtn.click();

    const loadingBtn = overlay.locator(".version-modal-btn.is-loading");
    await expect(loadingBtn).toHaveText("Checking…");
    await expect(loadingBtn).toBeDisabled();

    // The status row must NOT appear — that pop-in/out is the layout jump we removed.
    await expect(overlay.locator(".version-modal-status")).toBeHidden();

    // Let the check resolve; the modal settles into the up-to-date view.
    release();

    await expect(overlay.locator(".version-modal-body")).toContainText(
      "latest version",
    );
    await expect(overlay.locator(".version-modal-btn.is-loading")).toHaveCount(0);
  });
});
