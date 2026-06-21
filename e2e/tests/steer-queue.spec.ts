import { test, expect, collapseScratchpad } from "../lib/test";
import {
  buildSession,
  realWorkingDir,
  uniqueSessionName,
  writeSession,
} from "../lib/sessions";

// Steer/queue lets the user send a follow-up while a response is still running.
// The stub pi (e2e/lib/stub-pi/pi) honors a "[[slow:NNNN]]" marker to hold a run
// open, and folds any prompt that lands mid-run into the active turn (a steer).

test.describe("steer / queue (stubbed pi)", () => {
  async function openRunningSession(page, sessionsDir, testInfo, prefix) {
    const cwd = realWorkingDir();
    const { entries } = buildSession({ cwd });
    const name = uniqueSessionName(testInfo, prefix);
    const id = writeSession(sessionsDir, name, entries);

    await collapseScratchpad(page);
    await page.goto(`/session?id=${encodeURIComponent(id)}`);

    const composer = page.locator("#pi-chat-composer");
    await expect(composer).toHaveAttribute("data-chat-available", "true");

    const textarea = page.locator("#pi-chat-message");
    // Hold the run open for a few seconds so we can interact while running.
    await textarea.fill("task A [[slow:5000]]");
    await page.locator("#pi-chat-send").click();

    // While running, the Steer (send) and Queue buttons are available.
    await expect(page.locator("#pi-chat-queue")).toBeVisible();
    await expect(page.locator("#pi-chat-send")).toHaveText("Steer");
    return { textarea };
  }

  test("steering shows a pending chip and delivers the message", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const { textarea } = await openRunningSession(page, sessionsDir, testInfo, "steer");

    const steerMsg = `steer-${testInfo.workerIndex}-${Date.now()}`;
    await textarea.fill(steerMsg);
    await page.locator("#pi-chat-send").click();

    // A steer chip appears above the input until the run picks it up.
    const steerChip = page.locator("#pi-chat-pending .pi-chat-pending-steer");
    await expect(steerChip).toContainText(steerMsg);

    // The steered message is delivered and answered.
    await expect(page.locator("#messages")).toContainText(`Stub reply: ${steerMsg}`, {
      timeout: 20000,
    });

    // Once the run completes, the steer chip clears.
    await expect(steerChip).toHaveCount(0, { timeout: 20000 });
  });

  test("queued messages stack, are deletable, and auto-send after the run", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const { textarea } = await openRunningSession(page, sessionsDir, testInfo, "queue");

    const keep = `keep-${testInfo.workerIndex}-${Date.now()}`;
    const drop = `drop-${testInfo.workerIndex}-${Date.now()}`;

    await textarea.fill(keep);
    await page.locator("#pi-chat-queue").click();
    await textarea.fill(drop);
    await page.locator("#pi-chat-queue").click();

    const queuedChips = page.locator("#pi-chat-pending .pi-chat-pending-queued");
    await expect(queuedChips).toHaveCount(2);

    // Delete the second queued message before it is ever sent.
    await queuedChips.filter({ hasText: drop }).locator(".pi-chat-remove").click();
    await expect(queuedChips).toHaveCount(1);
    await expect(queuedChips.filter({ hasText: keep })).toHaveCount(1);

    // After the running response completes, the kept message auto-sends.
    await expect(page.locator("#messages")).toContainText(`Stub reply: ${keep}`, {
      timeout: 20000,
    });
    await expect(queuedChips).toHaveCount(0);
    // The deleted message was never sent.
    await expect(page.locator("#messages")).not.toContainText(`Stub reply: ${drop}`);
  });
});
