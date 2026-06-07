import { test, expect, collapseScratchpad, isMobileLayout } from "../lib/test";
import {
  buildSession,
  realWorkingDir,
  uniqueSessionName,
  writeSession,
} from "../lib/sessions";

// /compact is triggered from the context-usage popover (and Cmd/Ctrl+Shift+K).
// It is sent as a plain chat message down the same POST /api/chat -> worker path
// as any prompt, so the worker emits agent_end and the chat does not hang. The
// stub pi treats "/compact" as an ordinary prompt and echoes "Stub reply: ...".
test.describe("compact (stubbed pi)", () => {
  test("popover button sends /compact and the chat completes", async ({
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

    // The popover closes on trigger, the stub reply lands (no hang), and the
    // worker returns to idle — the Cancel button (shown only while running)
    // disappears, proving the chat completed instead of hanging.
    await expect(popover).toBeHidden();
    await expect(page.locator("#messages")).toContainText("Stub reply: /compact", {
      timeout: 20000,
    });
    await expect(page.locator("#pi-chat-cancel")).toBeHidden({ timeout: 20000 });
  });

  test("Cmd/Ctrl+Shift+K sends /compact while preserving the draft path", async ({
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

    // /compact is guarded against firing while the worker is "running" (e.g. the
    // initial worker warm-up after load). Wait for idle — the Cancel button is
    // shown only while running — to mirror a real user compacting a settled chat.
    await expect(page.locator("#pi-chat-cancel")).toBeHidden({ timeout: 20000 });

    const textarea = page.locator("#pi-chat-message");
    await textarea.click();
    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await textarea.press(`${modifier}+Shift+KeyK`);

    await expect(page.locator("#messages")).toContainText("Stub reply: /compact", {
      timeout: 20000,
    });
  });
});
