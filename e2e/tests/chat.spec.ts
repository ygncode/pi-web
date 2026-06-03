import { test, expect, collapseScratchpad } from "../lib/test";
import {
  buildSession,
  realWorkingDir,
  uniqueSessionName,
  writeSession,
} from "../lib/sessions";

// Chat is driven by a `pi --mode rpc` worker. CI has no real pi, so a stub pi
// (e2e/lib/stub-pi/pi, prepended to PATH by the server harness) answers the rpc
// protocol and writes a deterministic reply into the session file, which the
// browser then picks up via the live-reload SSE path.

test.describe("chat (stubbed pi)", () => {
  test("sending a message shows the assistant reply", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    // Session cwd must exist on disk or chat is disabled ("View only").
    const cwd = realWorkingDir();
    const { entries } = buildSession({ cwd });
    const name = uniqueSessionName(testInfo, "chat");
    const id = writeSession(sessionsDir, name, entries);

    await collapseScratchpad(page);
    await page.goto(`/session?id=${encodeURIComponent(id)}`);

    // Composer should be enabled (cwd exists -> chat available).
    const composer = page.locator("#pi-chat-composer");
    await expect(composer).toHaveAttribute("data-chat-available", "true");

    const textarea = page.locator("#pi-chat-message");
    const prompt = `e2e-chat-${testInfo.workerIndex}-${Date.now()}`;
    await textarea.fill(prompt);
    await page.locator("#pi-chat-send").click();

    // The stub echoes "Stub reply: <prompt>" and writes it to the session file;
    // it surfaces in the message pane via the fsnotify -> SSE reload.
    await expect(page.locator("#messages")).toContainText(`Stub reply: ${prompt}`, {
      timeout: 20000,
    });
  });
});
