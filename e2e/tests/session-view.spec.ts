import { test, expect } from "../lib/test";

async function openDemoSession(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.locator(".session-card", { hasText: "add deepseek-v4-pro" }).click();
  await expect(page).toHaveURL(/\/session\?id=/);
}

test.describe("session viewer", () => {
  test("renders the conversation tree", async ({ page }) => {
    await openDemoSession(page);

    const nodes = page.locator("#tree-container .tree-node");
    await expect(nodes.first()).toBeVisible();
    expect(await nodes.count()).toBeGreaterThan(5);

    await expect(page.locator("#tree-status")).toContainText(/entries/);
  });

  test("shows the user prompt in the message pane", async ({ page }) => {
    await openDemoSession(page);

    await expect(page.locator("#messages")).toContainText(
      "add deepseek-v4-pro to opencode-go-work-02 in pi model.",
    );
  });

  test("renders assistant + tool entries from fixture", async ({ page }) => {
    await openDemoSession(page);

    // Tree node display tags roles; assistant entries must be present.
    await expect(
      page.locator("#tree-container .tree-role-assistant").first(),
    ).toBeVisible();
  });
});
