import { test, expect, collapseScratchpad, isMobileLayout } from "../lib/test";
import {
  buildSession,
  realWorkingDir,
  uniqueSessionName,
  writeSession,
} from "../lib/sessions";

// /compact is triggered from the context-usage popover (and Cmd/Ctrl+L).
// It must hit the dedicated POST /api/compact endpoint, which runs pi's `compact`
// rpc command — NOT send "/compact" as a chat prompt (pi's rpc prompt path would
// treat it as literal text and never compact). The stub pi answers the `compact`
// command by writing a "Context compacted (stub)." marker; a wrongly-routed
// prompt would instead echo "Stub reply: /compact", so the assertions below
// distinguish the correct path from the broken one.
test.describe("compact (stubbed pi)", () => {
  test("popover button runs real compaction (not a /compact prompt)", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const cwd = realWorkingDir();
    const { entries } = buildSession({ cwd });
    // Attach usage to the assistant reply so the context-usage capsule renders.
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
    const name = uniqueSessionName(testInfo, "compact");
    const id = writeSession(sessionsDir, name, entries);

    await collapseScratchpad(page);
    await page.goto(`/session?id=${encodeURIComponent(id)}`);

    const composer = page.locator("#pi-chat-composer");
    await expect(composer).toHaveAttribute("data-chat-available", "true");

    // /compact is disabled while the worker is "running" (incl. the initial
    // warm-up). Wait for idle — Cancel is shown only while running — first.
    await expect(page.locator("#pi-chat-cancel")).toBeHidden({ timeout: 20000 });

    // Open the context popover and click the compact button.
    const capsule = page.locator("#pi-chat-context-usage");
    await expect(capsule).toBeVisible();
    const popover = page.locator("#pi-chat-context-popover");
    await capsule.click();
    await expect(popover).toBeVisible();

    const compactBtn = page.locator("#pi-chat-compact");
    await expect(compactBtn).toBeVisible();
    await compactBtn.click();

    // The popover closes on trigger, the stub's compaction marker lands (proving
    // the dedicated compact rpc path ran), and the worker returns to idle.
    // (The transient "compacting…" banner's show/hide is covered deterministically
    // in vitest — asserting its mid-flight visibility here races the fast stub.)
    await expect(popover).toBeHidden();
    await expect(page.locator("#messages")).toContainText("Context compacted (stub).", {
      timeout: 20000,
    });
    // Must NOT have gone down the chat-prompt path.
    await expect(page.locator("#messages")).not.toContainText("Stub reply: /compact");
    // Banner clears and the worker returns to idle once compaction completes.
    await expect(page.locator("#pi-chat-compacting-banner")).toBeHidden({ timeout: 20000 });
    await expect(page.locator("#pi-chat-cancel")).toBeHidden({ timeout: 20000 });
  });

  test("Cmd/Ctrl+L runs real compaction", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const cwd = realWorkingDir();
    const { entries } = buildSession({ cwd });
    const name = uniqueSessionName(testInfo, "compact-kbd");
    const id = writeSession(sessionsDir, name, entries);

    await collapseScratchpad(page);
    await page.goto(`/session?id=${encodeURIComponent(id)}`);

    test.skip(await isMobileLayout(page), "keyboard shortcut is desktop-only");

    const composer = page.locator("#pi-chat-composer");
    await expect(composer).toHaveAttribute("data-chat-available", "true");

    // Wait for the worker to settle to idle (compact is guarded while running).
    await expect(page.locator("#pi-chat-cancel")).toBeHidden({ timeout: 20000 });

    const textarea = page.locator("#pi-chat-message");
    await textarea.click();
    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await textarea.press(`${modifier}+KeyL`);

    await expect(page.locator("#messages")).toContainText("Context compacted (stub).", {
      timeout: 20000,
    });
    await expect(page.locator("#messages")).not.toContainText("Stub reply: /compact");
  });
});
