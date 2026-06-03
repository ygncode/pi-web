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

    const notes = page.locator(".session-card", { hasText: "Fix the failing unit test" });
    await expect(notes).toHaveAttribute("href", /\/session\?id=/);

    await notes.click();
    await expect(page).toHaveURL(/\/session\?id=/);
  });
});
