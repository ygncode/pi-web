import { test, expect } from "../lib/test";
import {
  buildSession,
  realWorkingDir,
  uniqueSessionName,
  writeSession,
} from "../lib/sessions";

// The /session shell embeds the session payload in <script id="pi-session-bootstrap">
// so the SPA paints the first frame without a round-trip to /api/session.
test.describe("session bootstrap (embedded payload)", () => {
  test("renders from the embedded payload without an /api/session fetch", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const { entries } = buildSession({ cwd: realWorkingDir() });
    const id = writeSession(sessionsDir, uniqueSessionName(testInfo, "boot"), entries);

    const apiSessionCalls: string[] = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (u.pathname === "/api/session") apiSessionCalls.push(u.search);
    });

    await page.goto(`/session?id=${encodeURIComponent(id)}`);
    await expect(page.locator("#messages")).toContainText("Initial");
    await expect(page.locator("#tree-container .tree-node").first()).toBeVisible();

    const hasBootstrap = await page.evaluate(
      () => !!document.getElementById("pi-session-bootstrap")?.textContent,
    );
    expect(hasBootstrap).toBe(true);
    // Initial paint comes from the embed — no /api/session GET on load.
    expect(apiSessionCalls).toEqual([]);
  });
});
