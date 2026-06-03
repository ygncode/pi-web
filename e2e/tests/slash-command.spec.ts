import { test, expect, collapseScratchpad } from "../lib/test";
import {
  buildSession,
  realWorkingDir,
  uniqueSessionName,
  writeSession,
} from "../lib/sessions";

// The slash-command palette opens when "/" begins the composer message and
// lists the commands pi loaded for the session (served by the get_commands rpc;
// the stub pi returns one extension + one prompt + one skill command). Only
// prompt and skill commands run an agent turn over the headless worker, so
// extension commands are filtered out of the palette.

test.describe("slash-command palette (stubbed pi)", () => {
  async function openSessionWithChat(page, sessionsDir, testInfo) {
    const cwd = realWorkingDir();
    const { entries } = buildSession({ cwd });
    const name = uniqueSessionName(testInfo, "slash");
    const id = writeSession(sessionsDir, name, entries);

    await collapseScratchpad(page);
    await page.goto(`/session?id=${encodeURIComponent(id)}`);

    const composer = page.locator("#pi-chat-composer");
    await expect(composer).toHaveAttribute("data-chat-available", "true");
    return page.locator("#pi-chat-message");
  }

  test("opens on '/', lists prompt + skill commands, hides extensions", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const textarea = await openSessionWithChat(page, sessionsDir, testInfo);

    await textarea.fill("/");

    const popup = page.locator("#pi-chat-slash-popup");
    await expect(popup).toBeVisible();

    // Two of the three stub commands reach the palette: the extension command
    // (btw) is excluded.
    const items = page.locator(".slash-item");
    await expect(items).toHaveCount(2);
    await expect(page.locator('.slash-item[data-insert="workon"]')).toBeVisible();
    await expect(
      page.locator('.slash-item[data-insert="skill:memory"]'),
    ).toBeVisible();
    await expect(page.locator('.slash-item[data-insert="btw"]')).toHaveCount(0);
  });

  test("filters as the query narrows", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const textarea = await openSessionWithChat(page, sessionsDir, testInfo);

    await textarea.fill("/");
    await expect(page.locator(".slash-item")).toHaveCount(2);

    await textarea.fill("/sk");
    const items = page.locator(".slash-item");
    await expect(items).toHaveCount(1);
    await expect(items.first()).toHaveAttribute("data-insert", "skill:memory");
  });

  test("Enter inserts the selected command into the composer", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const textarea = await openSessionWithChat(page, sessionsDir, testInfo);

    await textarea.fill("/sk");
    await expect(page.locator(".slash-item")).toHaveCount(1);

    await textarea.focus();
    await page.keyboard.press("Enter");

    await expect(textarea).toHaveValue("/skill:memory ");
    await expect(page.locator("#pi-chat-slash-popup")).toBeHidden();
  });

  test("clicking a command inserts it and closes the palette", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const textarea = await openSessionWithChat(page, sessionsDir, testInfo);

    await textarea.fill("/");
    await expect(page.locator(".slash-item")).toHaveCount(2);

    await page.locator('.slash-item[data-insert="workon"]').click();

    await expect(textarea).toHaveValue("/workon ");
    await expect(page.locator("#pi-chat-slash-popup")).toBeHidden();
  });
});
