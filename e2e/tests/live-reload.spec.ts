import { test, expect } from "../lib/test";
import {
  appendEntry,
  assistantTextEntry,
  buildSession,
  uniqueSessionName,
  writeSession,
} from "../lib/sessions";

test.describe("live reload (SSE)", () => {
  test("appended entry shows up without a manual refresh", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    // Each run gets its own session file so parallel projects don't collide.
    const { entries, lastId } = buildSession();
    const name = uniqueSessionName(testInfo, "lr");
    const id = writeSession(sessionsDir, name, entries);

    await page.goto(`/session?id=${encodeURIComponent(id)}`);
    await expect(page.locator("#messages")).toContainText("Initial reply.");

    // Append a new entry to the file on disk; fsnotify -> SSE -> DOM update.
    const marker = `LIVE_RELOAD_${testInfo.workerIndex}_${Date.now()}`;
    const { entry } = assistantTextEntry(lastId, marker);
    appendEntry(sessionsDir, name, entry);

    await expect(page.locator("#messages")).toContainText(marker, { timeout: 15000 });
  });
});
