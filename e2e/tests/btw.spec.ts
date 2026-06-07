import { test, expect, collapseScratchpad, isMobileLayout } from "../lib/test";
import {
  buildSession,
  realWorkingDir,
  uniqueSessionName,
  writeSession,
} from "../lib/sessions";

// The "btw" floating scratch-chat opens from the git bar. It runs its own
// `pi --mode rpc` worker (the stub on PATH answers it) keyed by a per-parent
// btw session, so a sent message flows worker -> session JSONL -> SSE -> render,
// exactly like the main composer. The window is desktop-oriented; on mobile it
// is kept mutually exclusive with the composer, so these specs gate on layout.

test.describe("btw floating scratch-chat (stubbed pi)", () => {
  test("opens from the git bar, shows the empty state, and closes", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const cwd = realWorkingDir();
    const { entries } = buildSession({ cwd });
    const id = writeSession(sessionsDir, uniqueSessionName(testInfo, "btw"), entries);

    await collapseScratchpad(page);
    await page.goto(`/session?id=${encodeURIComponent(id)}`);
    test.skip(
      await isMobileLayout(page),
      "btw window is desktop-oriented; mobile keeps it mutually exclusive with the composer",
    );

    const btwBtn = page.locator("#pi-btw-button");
    await expect(btwBtn).toBeVisible();
    await expect(btwBtn).toHaveAttribute("aria-expanded", "false");
    await btwBtn.click();

    const win = page.locator(".pi-btw-window");
    await expect(win).toBeVisible();
    await expect(btwBtn).toHaveAttribute("aria-expanded", "true");
    // No btw session yet -> empty state.
    await expect(win.locator(".pi-btw-empty")).toBeVisible();

    await win.locator(".pi-btw-close").click();
    await expect(win).toBeHidden();
    await expect(btwBtn).toHaveAttribute("aria-expanded", "false");
  });

  test("sending a message renders the optimistic user bubble and running state", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const cwd = realWorkingDir();
    const { entries } = buildSession({ cwd });
    const id = writeSession(sessionsDir, uniqueSessionName(testInfo, "btw"), entries);

    await collapseScratchpad(page);
    await page.goto(`/session?id=${encodeURIComponent(id)}`);
    test.skip(
      await isMobileLayout(page),
      "btw window is desktop-oriented; mobile keeps it mutually exclusive with the composer",
    );

    await page.locator("#pi-btw-button").click();
    const win = page.locator(".pi-btw-window");
    await expect(win).toBeVisible();

    const prompt = `btw-${testInfo.workerIndex}-${Date.now()}`;
    await win.locator("#pi-btw-input").fill(prompt);
    await win.locator("#pi-btw-send").click();

    // Input clears immediately; the optimistic user bubble renders the prompt.
    await expect(win.locator("#pi-btw-input")).toHaveValue("");
    await expect(win.locator(".pi-btw-msg.user")).toContainText(prompt);

    // Creating the btw session + sending flips the window into the running state
    // (the "working" assistant bubble). The canonical worker reply arrives via
    // the per-session SSE reload — covered for the worker path by chat.spec; the
    // btw session file lands in a per-cwd subdir the e2e fsnotify watcher races,
    // so we assert the deterministic optimistic + running render here.
    await expect(win.locator(".pi-btw-msg.working")).toBeVisible();
  });
});
