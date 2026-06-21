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

  test("steering shows a panel row and delivers the message", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const { textarea } = await openRunningSession(page, sessionsDir, testInfo, "steer");

    const steerMsg = `steer-${testInfo.workerIndex}-${Date.now()}`;
    await textarea.fill(steerMsg);
    await page.locator("#pi-chat-send").click();

    // A steer row appears in the queue panel until the run picks it up.
    const steerRow = page.locator(".pi-queue-item.pi-queue-item--steer");
    await expect(steerRow).toContainText(steerMsg);

    // The steered message is delivered and answered.
    await expect(page.locator("#messages")).toContainText(`Stub reply: ${steerMsg}`, {
      timeout: 20000,
    });

    // Once the run completes, the steer row clears.
    await expect(steerRow).toHaveCount(0, { timeout: 20000 });
  });

  test("user can dismiss a pending steer row before pickup", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const { textarea } = await openRunningSession(page, sessionsDir, testInfo, "steer-cancel");

    const steerMsg = `dismiss-${testInfo.workerIndex}-${Date.now()}`;
    await textarea.fill(steerMsg);
    await page.locator("#pi-chat-send").click();

    const steerRow = page.locator(".pi-queue-item.pi-queue-item--steer");
    await expect(steerRow).toContainText(steerMsg);

    // Removing the steer row from the panel hides the chip immediately. The
    // message has already been sent to pi (and will still arrive in the
    // conversation), but the in-flight indicator goes away.
    await steerRow.locator(".pi-queue-item-remove").click();
    await expect(steerRow).toHaveCount(0);
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

    // Queue rows are the non-steer rows in the panel.
    const queuedRows = page.locator(".pi-queue-item:not(.pi-queue-item--steer)");
    await expect(queuedRows).toHaveCount(2);

    // Delete the second queued message before it is ever sent.
    await queuedRows.filter({ hasText: drop }).locator(".pi-queue-item-remove").click();
    await expect(queuedRows).toHaveCount(1);
    await expect(queuedRows.filter({ hasText: keep })).toHaveCount(1);

    // After the running response completes, the kept message auto-sends.
    await expect(page.locator("#messages")).toContainText(`Stub reply: ${keep}`, {
      timeout: 20000,
    });
    await expect(queuedRows).toHaveCount(0);
    // The deleted message was never sent.
    await expect(page.locator("#messages")).not.toContainText(`Stub reply: ${drop}`);
  });

  test("pause holds queued messages until the user resumes", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const { textarea } = await openRunningSession(page, sessionsDir, testInfo, "queue-pause");

    const msg = `paused-${testInfo.workerIndex}-${Date.now()}`;
    await textarea.fill(msg);
    await page.locator("#pi-chat-queue").click();

    // Pause from the panel header.
    await page.getByRole("button", { name: /^Pause$/ }).click();
    await expect(page.locator(".pi-queue-panel--paused")).toBeVisible();

    // Even after the run completes, the message stays in the queue.
    await expect(page.locator(".pi-queue-item")).toHaveCount(1, { timeout: 20000 });

    // Resume kicks the message out.
    await page.getByRole("button", { name: /^Resume$/ }).click();
    await expect(page.locator("#messages")).toContainText(`Stub reply: ${msg}`, {
      timeout: 20000,
    });
    await expect(page.locator(".pi-queue-item")).toHaveCount(0);
  });
});
