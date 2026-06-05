import { test, expect } from "../lib/test";
import {
  buildSession,
  realWorkingDir,
  uniqueSessionName,
  writeSession,
} from "../lib/sessions";

// The context-usage capsule (the small "N%" ring next to Send) only renders
// when the session has assistant token usage. Clicking it must toggle the
// detailed breakdown popover. This guards a migration regression where the
// popover/capsule inner markup was dropped and the popover opened empty.
test.describe("context usage popover", () => {
  test("capsule opens and closes the context details popover", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const cwd = realWorkingDir();
    const { entries } = buildSession({ cwd });
    // Attach usage to the assistant reply so the capsule appears.
    const assistant = entries.find(
      (e: any) => e?.message?.role === "assistant",
    ) as any;
    assistant.message.usage = {
      input: 1331,
      output: 220,
      cacheRead: 6144,
      cacheWrite: 0,
      totalTokens: 7695,
    };
    const name = uniqueSessionName(testInfo, "ctx");
    const id = writeSession(sessionsDir, name, entries);

    await page.goto(`/session?id=${encodeURIComponent(id)}`);

    const capsule = page.locator("#pi-chat-context-usage");
    await expect(capsule).toBeVisible();

    const popover = page.locator("#pi-chat-context-popover");
    await expect(popover).toBeHidden();

    // Open: popover becomes visible and is populated with the token breakdown.
    await capsule.click();
    await expect(popover).toBeVisible();
    await expect(popover.locator("#pi-popover-val-total")).toHaveText("7.7k");
    await expect(popover.locator(".pi-popover-used")).toHaveText("7.7k");

    // Close via the × button (the popover is a sibling of the capsule, so this
    // click does not reach the capsule's own toggle handler).
    await popover.locator(".pi-popover-close").click();
    await expect(popover).toBeHidden();

    // Re-open, then close by toggling the capsule again.
    await capsule.click();
    await expect(popover).toBeVisible();
    await capsule.click();
    await expect(popover).toBeHidden();
  });
});
