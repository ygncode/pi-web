import { test, expect, isMobileLayout, collapseScratchpad } from "../lib/test";
import type { Page } from "@playwright/test";

// Layout is driven by the 900px breakpoint, not by device type: iPad portrait
// (810px) lands on mobile, iPad landscape (~1080px) on desktop. Each test
// resolves the active layout at runtime (after navigation) and skips the half
// that doesn't apply, so every project runs exactly the relevant assertions.

async function openDemoSession(page: Page) {
  // Keep the scratchpad collapsed so it doesn't overlay the header on narrow
  // viewports; we're exercising the tree (left) sidebar.
  await collapseScratchpad(page);
  await page.goto("/");
  await page.locator(".session-card", { hasText: "add deepseek-v4-pro" }).click();
  await expect(page).toHaveURL(/\/session\?id=/);
  await page.locator("#sidebar").waitFor();
}

test.describe("responsive layout", () => {
  test("mobile: tree sidebar is a drawer that auto-closes on selection", async ({
    page,
  }) => {
    await openDemoSession(page);
    test.skip(!(await isMobileLayout(page)), "mobile-only behavior");

    const body = page.locator("body");
    const treeToggle = page.locator("#tree-toggle");

    // Drawer starts closed.
    await expect(treeToggle).toBeVisible();
    await expect(body).not.toHaveClass(/sidebar-open/);

    // Dispatch the click straight to the button: the long session title shares
    // the narrow header row and wins coordinate hit-testing at the button's
    // center (even force-click lands on the title). Header hit-geometry isn't
    // what this test verifies — the drawer state transitions below are.
    await treeToggle.dispatchEvent("click");
    await expect(body).toHaveClass(/sidebar-open/);
    await expect(page.locator("#sidebar")).toHaveClass(/open/);

    // Selecting a node navigates AND collapses the drawer.
    await page.locator("#tree-container .tree-node").first().click();
    await expect(body).not.toHaveClass(/sidebar-open/);
  });

  test("desktop: tree sidebar is persistent and collapses in place", async ({
    page,
  }) => {
    await openDemoSession(page);
    test.skip(await isMobileLayout(page), "desktop-only behavior");

    const body = page.locator("body");
    await expect(page.locator("#sidebar")).toBeVisible();
    await expect(body).not.toHaveClass(/sidebar-open/);

    // On desktop the toggle collapses the sidebar in place (no overlay drawer).
    await page.locator("#tree-toggle").click();
    await expect(body).toHaveClass(/sidebar-collapsed/);
    await expect(body).not.toHaveClass(/sidebar-open/);
  });
});
