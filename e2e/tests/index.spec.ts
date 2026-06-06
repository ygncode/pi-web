import { test, expect } from "../lib/test";

test.describe("sessions index", () => {
  test("renders a card per fixture session", async ({ page }) => {
    await page.goto("/");

    const demo = page.locator(".session-card", { hasText: "add deepseek-v4-pro" });
    const notes = page.locator(".session-card", { hasText: "Fix the failing unit test" });

    await expect(demo).toBeVisible();
    await expect(notes).toBeVisible();
  });

  test("groups cards by sanitized project path", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.locator('.project-group[data-project="/home/user/demo-project"]'),
    ).toBeVisible();
    await expect(
      page.locator('.project-group[data-project="/home/user/notes-app"]'),
    ).toBeVisible();
  });

  test("card links to its session view", async ({ page }) => {
    await page.goto("/");

    // The index re-renders the cards once its initial refresh finishes (marked
    // by .index-layout-ready). Clicking before that can land on a card that's
    // replaced mid-click, so the navigation never fires. Wait for it to settle.
    await page.locator("[data-sessions-content].index-layout-ready").waitFor();

    const notes = page.locator(".session-card", { hasText: "Fix the failing unit test" });
    await expect(notes).toHaveAttribute("href", /\/session\?id=/);

    await notes.click();
    await expect(page).toHaveURL(/\/session\?id=/, { timeout: 15000 });
  });
});
