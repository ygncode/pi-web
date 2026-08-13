import { test, expect, collapseScratchpad } from "../lib/test";
import { suspendSteerChipCleanup } from "../lib/chat";
import {
  buildSession,
  realWorkingDir,
  uniqueSessionName,
  writeSession,
} from "../lib/sessions";

// Steer/queue lets the user send a follow-up while a response is still running.
// The stub pi (e2e/lib/stub-pi/pi) honors a "[[slow:NNNN]]" marker to hold a run
// open, and folds any prompt that lands mid-run into the active turn (a steer).

// The e2e suite runs many projects in parallel against one pi-web backend that
// serializes SQLite writes; under that load a single POST /api/chat/queue
// round-trip can exceed Playwright's default 5s expect window, and the
// autonomous queue drainer racing with parallel test sessions amplifies the
// contention. Run this file's tests serially within each project worker (cross-
// project parallelism still gives us a healthy fan-out for browser coverage)
// and keep a single retry for genuine flakes.
test.describe.configure({ mode: "serial", retries: 1 });

test.describe("steer / queue (stubbed pi)", () => {
  async function openRunningSession(
    page,
    sessionsDir,
    testInfo,
    prefix,
    { slowMs = 5000 } = {},
  ) {
    const cwd = realWorkingDir();
    const { entries } = buildSession({ cwd });
    const name = uniqueSessionName(testInfo, prefix);
    const id = writeSession(sessionsDir, name, entries);

    await collapseScratchpad(page);
    await page.goto(`/session?id=${encodeURIComponent(id)}`);

    const composer = page.locator("#pi-chat-composer");
    await expect(composer).toHaveAttribute("data-chat-available", "true");

    const textarea = page.locator("#pi-chat-message");
    // Hold the run open so we can interact while running. Pass slowMs to
    // extend this for tests that need the worker to stay busy through pause
    // setup so the autonomous backend drainer can't dispatch items first.
    await textarea.fill(`task A [[slow:${slowMs}]]`);
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
    // Long slow-hold so the original run is unambiguously still in flight when
    // the steer lands — otherwise on a slow CI runner the worker can flip to
    // idle (pi-worker-done) between openRunningSession and our click,
    // dropping activeRun=false so the next send becomes a fresh turn instead
    // of a steer.
    const { textarea } = await openRunningSession(page, sessionsDir, testInfo, "steer", {
      slowMs: 30000,
    });

    const steerMsg = `steer-${testInfo.workerIndex}-${Date.now()}`;
    const release = await suspendSteerChipCleanup(page);
    await textarea.fill(steerMsg);
    await page.locator("#pi-chat-send").click();

    // A steer row appears in the queue panel until the run picks it up.
    const steerRow = page.locator(".pi-queue-item.pi-queue-item--steer");
    await expect(steerRow).toContainText(steerMsg);

    // Release the refetch stall so the auto-clear can fire on the next event.
    await release();

    // The steered message is delivered and answered.
    await expect(page.locator("#messages")).toContainText(`Stub reply: ${steerMsg}`, {
      timeout: 20000,
    });

    // Once the run completes (and the user message lands), the steer row clears.
    await expect(steerRow).toHaveCount(0, { timeout: 20000 });
  });

  test("steer chip clears as soon as pi echoes the user message (not waiting for run-end)", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    // 30s slow-hold so the original run is still in flight when the steer
    // lands. The chip must clear well before agent_end fires (we'd be done
    // long before this test's 30s timeout if we waited for the run instead).
    const { textarea } = await openRunningSession(page, sessionsDir, testInfo, "steer-fast", {
      slowMs: 30000,
    });

    const steerMsg = `fast-steer-${testInfo.workerIndex}-${Date.now()}`;
    const release = await suspendSteerChipCleanup(page);
    await textarea.fill(steerMsg);
    await page.locator("#pi-chat-send").click();

    const steerRow = page.locator(".pi-queue-item.pi-queue-item--steer");
    await expect(steerRow).toContainText(steerMsg);

    // Release the refetch stall — that's the event the cleanup hangs on.
    await release();

    // The stub pi writes the steer's user turn to the JSONL immediately
    // (e2e/lib/stub-pi/pi#handlePrompt, the `activeSlowRun` branch); the file
    // watcher → SSE 'reload' → /api/session refetch → reconcile pipeline puts
    // the entry into the model. The steer chip must disappear within a few
    // seconds of that — well before the 30s slow run ends.
    await expect(page.locator("#messages")).toContainText(steerMsg, { timeout: 10000 });
    await expect(steerRow).toHaveCount(0, { timeout: 5000 });
  });

  test("user can dismiss a pending steer row before pickup", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    // Long slow-hold so activeRun stays true through the click — see the
    // matching note on "steering shows a panel row". Plus a refetch stall so
    // the auto-clear doesn't beat us to the X button.
    const { textarea } = await openRunningSession(page, sessionsDir, testInfo, "steer-cancel", {
      slowMs: 30000,
    });

    const steerMsg = `dismiss-${testInfo.workerIndex}-${Date.now()}`;
    const release = await suspendSteerChipCleanup(page);
    await textarea.fill(steerMsg);
    await page.locator("#pi-chat-send").click();

    const steerRow = page.locator(".pi-queue-item.pi-queue-item--steer");
    await expect(steerRow).toContainText(steerMsg);

    // Removing the steer row from the panel hides the chip immediately. The
    // message has already been sent to pi (and will still arrive in the
    // conversation), but the in-flight indicator goes away.
    await steerRow.locator(".pi-queue-item-remove").click();
    await expect(steerRow).toHaveCount(0);
    await release();
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

  // Keyboard shortcut tests live below. The panel's document-level keydown
  // listener fires whenever the panel is visible AND the textarea is empty
  // (or focus is outside any editable field) so the shortcuts in the footer
  // ('↑↓ navigate · E edit · ⌫ delete · ↩ send now · Esc exit') work without
  // first clicking into the listbox.

  async function queueThree(page, textarea, testInfo, prefix) {
    const items = [
      `${prefix}-1-${testInfo.workerIndex}-${Date.now()}`,
      `${prefix}-2-${testInfo.workerIndex}-${Date.now()}`,
      `${prefix}-3-${testInfo.workerIndex}-${Date.now()}`,
    ];
    // Serialize the queue button clicks so each POST /api/chat/queue lands
    // (and the panel updates) before the next item is added. Without this
    // wait the three POSTs race and items may arrive out of input order.
    // Use a generous timeout: the e2e suite runs many tests in parallel
    // against one pi-web backend that serializes SQLite writes, so a single
    // POST round-trip can take longer than the default 5s expect window.
    for (let i = 0; i < items.length; i++) {
      await textarea.fill(items[i]);
      await page.locator("#pi-chat-queue").click();
      await expect(page.locator(".pi-queue-item")).toHaveCount(i + 1, { timeout: 15000 });
    }
    // Textarea is cleared by each Queue press; the panel auto-focuses the first
    // row (focusIndex = 0), so the shortcut listener targets that row.
    await expect(page.locator(".pi-queue-item--focused")).toHaveCount(1, { timeout: 5000 });
    return items;
  }

  test("ArrowDown / ArrowUp move the focused row", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    // 30s slow-hold so the backend drainer never gets to dispatch items
    // mid-test (which would yank rows out from under the keyboard cursor).
    const { textarea } = await openRunningSession(page, sessionsDir, testInfo, "kb-nav", {
      slowMs: 30000,
    });
    const items = await queueThree(page, textarea, testInfo, "nav");

    const rows = page.locator(".pi-queue-item");
    await expect(rows.nth(0)).toHaveClass(/pi-queue-item--focused/);

    await page.keyboard.press("ArrowDown");
    await expect(rows.nth(1)).toHaveClass(/pi-queue-item--focused/);

    await page.keyboard.press("ArrowDown");
    await expect(rows.nth(2)).toHaveClass(/pi-queue-item--focused/);

    // Wrap to the top.
    await page.keyboard.press("ArrowDown");
    await expect(rows.nth(0)).toHaveClass(/pi-queue-item--focused/);

    // ArrowUp wraps to the bottom.
    await page.keyboard.press("ArrowUp");
    await expect(rows.nth(2)).toHaveClass(/pi-queue-item--focused/);

    // Sanity: items list unchanged.
    for (let i = 0; i < items.length; i++) {
      await expect(rows.nth(i)).toContainText(items[i]);
    }
  });

  test("Backspace removes the focused row", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const { textarea } = await openRunningSession(page, sessionsDir, testInfo, "kb-del", {
      slowMs: 30000,
    });
    const items = await queueThree(page, textarea, testInfo, "del");

    // Focus moves to index 1, then delete; row containing items[1] should go.
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Backspace");

    const rows = page.locator(".pi-queue-item");
    await expect(rows).toHaveCount(2);
    await expect(page.locator(".pi-queue-item-text", { hasText: items[1] })).toHaveCount(0);
    await expect(page.locator(".pi-queue-item-text", { hasText: items[0] })).toHaveCount(1);
    await expect(page.locator(".pi-queue-item-text", { hasText: items[2] })).toHaveCount(1);
  });

  test("Enter sends the focused queued row immediately (skip-ahead)", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const { textarea } = await openRunningSession(page, sessionsDir, testInfo, "kb-enter", {
      slowMs: 30000,
    });
    const items = await queueThree(page, textarea, testInfo, "enter");

    // The stub echoes the steered message into the JSONL immediately, and the
    // chip auto-clears on the resulting reload (reconcileSteersAgainstEntries)
    // — often faster than the assertions below can run. Stall the cleanup so
    // the steer row is reliably observable, like the other steer-row tests.
    const release = await suspendSteerChipCleanup(page);

    // Skip ahead to the third item.
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    // items[2] becomes an in-flight steer (we're still mid-run), so it leaves
    // the queued list and shows up as a steer row instead.
    await expect(page.locator(".pi-queue-item:not(.pi-queue-item--steer)")).toHaveCount(2);
    await expect(page.locator(".pi-queue-item-text", { hasText: items[2] })).toHaveCount(1);
    // The first two are still queued (in order).
    const queuedTexts = await page.locator(".pi-queue-item:not(.pi-queue-item--steer) .pi-queue-item-text").allTextContents();
    expect(queuedTexts).toEqual([items[0], items[1]]);

    await release();

    // The sent message also reaches the conversation as a "Stub reply".
    await expect(page.locator("#messages")).toContainText(`Stub reply: ${items[2]}`, {
      timeout: 20000,
    });
  });

  test("E pops the focused row back into the textarea for editing", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const { textarea } = await openRunningSession(page, sessionsDir, testInfo, "kb-edit", {
      slowMs: 30000,
    });
    const items = await queueThree(page, textarea, testInfo, "edit");

    await page.keyboard.press("ArrowDown"); // focus items[1]
    await page.keyboard.press("e");

    await expect(textarea).toHaveValue(items[1]);
    await expect(page.locator(".pi-queue-item")).toHaveCount(2);
    await expect(page.locator(".pi-queue-item-text", { hasText: items[1] })).toHaveCount(0);
  });

  test("Esc unfocuses the panel and refocuses the textarea", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const { textarea } = await openRunningSession(page, sessionsDir, testInfo, "kb-esc", {
      slowMs: 30000,
    });
    await queueThree(page, textarea, testInfo, "esc");

    await page.keyboard.press("Escape");
    await expect(page.locator(".pi-queue-item--focused")).toHaveCount(0);
    // Textarea regains focus so the user can type the next message immediately.
    await expect(textarea).toBeFocused();
  });

  test("typing in the textarea suppresses the panel shortcuts", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const { textarea } = await openRunningSession(page, sessionsDir, testInfo, "kb-suppress", {
      slowMs: 30000,
    });
    await queueThree(page, textarea, testInfo, "sup");

    // Start typing into the textarea; the panel listener must not hijack keys.
    await textarea.focus();
    await page.keyboard.type("hello");
    await expect(textarea).toHaveValue("hello");

    // The focused row stays put: Backspace edits the textarea, doesn't delete.
    const rowsBefore = await page.locator(".pi-queue-item").count();
    expect(rowsBefore).toBe(3);

    await page.keyboard.press("Backspace");
    await expect(textarea).toHaveValue("hell");
    await expect(page.locator(".pi-queue-item")).toHaveCount(3);

    // Arrow keys also don't move panel focus while text is in the textarea.
    const focusedTextBefore = await page.locator(".pi-queue-item--focused .pi-queue-item-text").textContent();
    await page.keyboard.press("ArrowDown");
    const focusedTextAfter = await page.locator(".pi-queue-item--focused .pi-queue-item-text").textContent();
    expect(focusedTextAfter).toBe(focusedTextBefore);
  });

  test("queue panel sits above the composer card", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const { textarea } = await openRunningSession(page, sessionsDir, testInfo, "above-shell", {
      slowMs: 30000,
    });
    await textarea.fill("anywhere");
    await page.locator("#pi-chat-queue").click();

    // The panel must render as a sibling outside .pi-chat-shell so it floats
    // above the composer card instead of being nested inside it.
    const panel = page.locator(".pi-queue-panel");
    await expect(panel).toBeVisible({ timeout: 15000 });
    const isOutsideShell = await panel.evaluate(
      (el) => !el.closest(".pi-chat-shell"),
    );
    expect(isOutsideShell).toBe(true);

    // Visually: the panel's bottom edge sits above the shell's top edge, and
    // the two share the same horizontal extent (the panel must not sprawl past
    // the composer when the sidebar is collapsed and the column is wider).
    const panelBox = await panel.boundingBox();
    const shellBox = await page.locator(".pi-chat-shell").boundingBox();
    expect(panelBox && shellBox).toBeTruthy();
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(shellBox!.y + 1);
    expect(Math.abs(panelBox!.x - shellBox!.x)).toBeLessThan(2);
    expect(Math.abs(panelBox!.width - shellBox!.width)).toBeLessThan(2);
  });

  test("queued messages survive a browser refresh (server-backed queue)", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    // 30s slow-hold so the autonomous drainer never gets a window to dispatch
    // the queued item before we manage to pause the panel.
    const { textarea } = await openRunningSession(page, sessionsDir, testInfo, "persist", {
      slowMs: 30000,
    });

    const keep = `persist-${testInfo.workerIndex}-${Date.now()}`;
    await textarea.fill(keep);
    await page.locator("#pi-chat-queue").click();
    // Wait for the POST round-trip to land the item before reaching for the
    // Pause button (which lives inside the now-visible panel header).
    await expect(page.locator(".pi-queue-item")).toHaveCount(1, { timeout: 15000 });
    await expect(page.locator(".pi-queue-status-saved")).toBeVisible();
    await page.getByRole("button", { name: /^Pause$/ }).click();
    await expect(page.locator(".pi-queue-panel--paused")).toBeVisible();

    // Reload and confirm the queued row + paused flag came back from the server.
    await page.reload();
    await expect(page.locator("#pi-chat-composer")).toHaveAttribute("data-chat-available", "true");

    await expect(page.locator(".pi-queue-item")).toHaveCount(1, { timeout: 10000 });
    await expect(page.locator(".pi-queue-item")).toContainText(keep);
    await expect(page.locator(".pi-queue-panel--paused")).toBeVisible();
  });

  test("queue survives a full browser close + new context (server-backed, all storage cleared)", async ({
    browser,
    sessionsDir,
  }, testInfo) => {
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await collapseScratchpad(page1);

    const cwd = realWorkingDir();
    const { entries } = buildSession({ cwd });
    const name = uniqueSessionName(testInfo, "close");
    const id = writeSession(sessionsDir, name, entries);

    await page1.goto(`/session?id=${encodeURIComponent(id)}`);
    await expect(page1.locator("#pi-chat-composer")).toHaveAttribute("data-chat-available", "true");

    // Pause first so the autonomous drainer doesn't snap the message into pi
    // before we get a chance to see it from the second context.
    const msg = `close-${testInfo.workerIndex}-${Date.now()}`;
    await page1.locator("#pi-chat-message").fill(msg);
    // Need a running state for the Queue button to appear — but we want the
    // queue to outlive a full browser close, so pause as soon as it's there.
    await page1.locator("#pi-chat-message").fill("task A [[slow:30000]]");
    await page1.locator("#pi-chat-send").click();
    await expect(page1.locator("#pi-chat-queue")).toBeVisible();
    await page1.locator("#pi-chat-message").fill(msg);
    await page1.locator("#pi-chat-queue").click();
    await expect(page1.locator(".pi-queue-item")).toContainText(msg);
    await page1.getByRole("button", { name: /^Pause$/ }).click();
    await expect(page1.locator(".pi-queue-panel--paused")).toBeVisible();
    await context1.close();

    // Brand-new browser context: cookies, localStorage, IndexedDB all gone.
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await collapseScratchpad(page2);
    await page2.goto(`/session?id=${encodeURIComponent(id)}`);
    await expect(page2.locator("#pi-chat-composer")).toHaveAttribute("data-chat-available", "true");
    await expect(page2.locator(".pi-queue-item")).toHaveCount(1, { timeout: 10000 });
    await expect(page2.locator(".pi-queue-item")).toContainText(msg);
    await expect(page2.locator(".pi-queue-panel--paused")).toBeVisible();
    await context2.close();
  });

  test("the 'auto-sending' hint shows when the panel is server-backed", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const { textarea } = await openRunningSession(page, sessionsDir, testInfo, "saved-hint", {
      slowMs: 30000,
    });
    await textarea.fill("hello");
    await page.locator("#pi-chat-queue").click();
    const hint = page.locator(".pi-queue-status-saved");
    await expect(hint).toBeVisible();
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
