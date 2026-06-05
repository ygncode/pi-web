import { test, expect } from "../lib/test";
import {
  assistantTextEntry,
  buildSession,
  uniqueSessionName,
  writeSession,
} from "../lib/sessions";

// NOTE: actually creating a share creates a GitHub Gist via the `gh` CLI
// (external + network + side effects), so we never trigger a real share here.
// We assert the live-only Share affordance exists and the endpoint contract,
// and we render the snapshot via the local preview mode (?preview=1, no gh) to
// exercise the real exported HTML without network.

test.describe("share / export", () => {
  test("exported snapshot renders inside a sandboxed iframe", async ({
    page,
    request,
    sessionsDir,
  }, testInfo) => {
    // A real Gist preview loads the export HTML in a sandboxed iframe WITHOUT
    // `allow-same-origin`, where even *reading* window.localStorage throws
    // SecurityError. That previously crashed the bootstrap and blanked the page.
    // Reproduce it: fetch the self-contained snapshot (preview mode skips gh)
    // and load it into exactly such an iframe, asserting the conversation
    // actually renders. Regression guard for the export bundle.
    const MARKER = "SANDBOX_RENDER_MARKER";
    const { entries, lastId } = buildSession();
    const { entry } = assistantTextEntry(lastId, MARKER);
    entries.push(entry);
    const id = writeSession(
      sessionsDir,
      uniqueSessionName(testInfo, "share"),
      entries,
    );

    const res = await request.get(
      `/share?id=${encodeURIComponent(id)}&preview=1`,
    );
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"]).toContain("text/html");
    const html = await res.text();

    await page.setContent(
      `<iframe id="snap" sandbox="allow-scripts" style="width:100%;height:90vh;border:0"></iframe>`,
    );
    // Set srcdoc as a property to avoid HTML-attribute escaping of the full doc.
    await page.evaluate((doc) => {
      (document.getElementById("snap") as HTMLIFrameElement).srcdoc = doc;
    }, html);

    // If the bootstrap crashed on localStorage access, #messages stays empty
    // and this times out — which is exactly the bug this guards against.
    const frame = page.frameLocator("#snap");
    await expect(frame.locator("#messages")).toContainText(MARKER, {
      timeout: 15_000,
    });
    await expect(frame.locator("#messages")).toContainText("Initial reply.");
  });

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
