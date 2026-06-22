// One-shot screenshot capture for the chat queue + steer flow.
// Not part of the regular suite — opt in with `--grep "@screenshots"`.
// Saves PNGs into docs/screenshots/queue-and-steer/ for use in the README / PR.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect, collapseScratchpad } from "../lib/test";
import {
  buildSession,
  realWorkingDir,
  uniqueSessionName,
  writeSession,
} from "../lib/sessions";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = path.resolve(__dirname, "../../docs/screenshots/queue-and-steer");

test.describe("@screenshots queue + steer panel @screenshots", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("captures queue + steer states @screenshots", async ({ page, sessionsDir }, testInfo) => {
    const cwd = realWorkingDir();
    const { entries } = buildSession({ cwd });
    const name = uniqueSessionName(testInfo, "shots");
    const id = writeSession(sessionsDir, name, entries);

    await collapseScratchpad(page);
    await page.goto(`/session?id=${encodeURIComponent(id)}`);
    await expect(page.locator("#pi-chat-composer")).toHaveAttribute("data-chat-available", "true");

    const textarea = page.locator("#pi-chat-message");
    const composer = page.locator("#pi-chat-composer");

    // Hold the run open for a long time so the autonomous drainer can't pull
    // items out from under the screenshots.
    await textarea.fill("audit the cwd's tests and report findings [[slow:60000]]");
    await page.locator("#pi-chat-send").click();
    await expect(page.locator("#pi-chat-queue")).toBeVisible();
    await expect(page.locator("#pi-chat-send")).toHaveText("Steer");

    // ── 1. Steer chip mid-flight ─────────────────────────────────────────────
    // The chip clears the moment pi echoes the user entry back via SSE reload
    // (steer-queue.js's reconcileSteersAgainstEntries) — which in stub-pi is
    // ~50ms. Stall the /api/session refetch that the SSE 'reload' triggers so
    // the chip stays on screen long enough to capture.
    let stallReloads = true;
    await page.route("**/api/session?**", async (route) => {
      while (stallReloads) await new Promise((r) => setTimeout(r, 100));
      try {
        await route.continue();
      } catch {
        /* route may already be handled if the page navigated away */
      }
    });
    await textarea.fill("focus on the integration tests first");
    await page.locator("#pi-chat-send").click();
    await expect(page.locator(".pi-queue-item.pi-queue-item--steer")).toBeVisible();
    await composer.screenshot({
      path: path.join(SHOT_DIR, "01-steer-in-flight.png"),
      animations: "disabled",
    });
    stallReloads = false;
    await page.unroute("**/api/session?**");
    // Let the deferred reload finish before moving on so subsequent shots see
    // a clean steer-cleared state.
    await expect(page.locator(".pi-queue-item.pi-queue-item--steer")).toHaveCount(0, {
      timeout: 10000,
    });

    // ── 2. Queue stacked with multiple items ─────────────────────────────────
    const queued = [
      "and don't forget the auth tests",
      "summarize at the end",
      "open a PR if anything is broken",
    ];
    for (let i = 0; i < queued.length; i++) {
      await textarea.fill(queued[i]);
      await page.locator("#pi-chat-queue").click();
      await expect(page.locator(".pi-queue-item:not(.pi-queue-item--steer)")).toHaveCount(i + 1);
    }
    await composer.screenshot({
      path: path.join(SHOT_DIR, "02-queue-stacked.png"),
      animations: "disabled",
    });

    // ── 3. Keyboard focus on a row + shortcut hints visible ──────────────────
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await composer.screenshot({
      path: path.join(SHOT_DIR, "03-keyboard-focused.png"),
      animations: "disabled",
    });

    // ── 4. Paused state ──────────────────────────────────────────────────────
    await page.getByRole("button", { name: /^Pause$/ }).click();
    await expect(page.locator(".pi-queue-panel--paused")).toBeVisible();
    await composer.screenshot({
      path: path.join(SHOT_DIR, "04-paused.png"),
      animations: "disabled",
    });
  });
});
