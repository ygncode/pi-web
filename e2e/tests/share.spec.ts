import { test, expect } from "../lib/test";

// NOTE: actually creating a share creates a GitHub Gist via the `gh` CLI
// (external + network + side effects), so we never trigger a real share here.
// We assert the live-only Share affordance exists and the endpoint contract,
// stopping before any gist is created. Export-HTML generation is covered by Go
// unit tests (internal/ui/export.go).

test.describe("share / export", () => {
  test("live session page exposes the Share action", async ({ page }) => {
    await page.goto("/");
    await page.locator(".session-card", { hasText: "add deepseek-v4-pro" }).click();
    await expect(page).toHaveURL(/\/session\?id=/);

    // Present in the live DOM (may live in a header menu depending on width);
    // its mere presence is the live-only chrome the export snapshot omits.
    await expect(page.locator("#share-btn")).toBeAttached();
  });

  test("share endpoint rejects missing id without side effects", async ({ request }) => {
    // Missing id short-circuits before any gh/gist work — safe + deterministic.
    const res = await request.post("/share");
    expect(res.status()).toBe(400);
    expect(await res.text()).toContain("missing id");
  });

  test("share endpoint rejects non-POST methods", async ({ request }) => {
    const res = await request.get("/share?id=demo.jsonl");
    expect(res.status()).toBe(405);
  });
});
