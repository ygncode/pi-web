import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect, collapseScratchpad } from "../lib/test";
import { buildSession, uniqueSessionName, writeSession } from "../lib/sessions";

// The @mention autocomplete opens when "@" is typed in the composer and lists
// files/folders under the session's working directory, served by GET /api/files
// (a bounded Go walk of cwd). These tests seed a real temp cwd with known files
// so the endpoint has something deterministic to return.

// seedCwd creates a temp dir with a fixed file/folder layout and returns it.
function seedCwd(): string {
  const dir = mkdtempSync(join(tmpdir(), "pi-web-e2e-mention-"));
  writeFileSync(join(dir, "app.js"), "x");
  writeFileSync(join(dir, "app.test.js"), "x");
  writeFileSync(join(dir, "README.md"), "x");
  mkdirSync(join(dir, "lib"), { recursive: true });
  writeFileSync(join(dir, "lib", "util.js"), "x");
  return dir;
}

test.describe("@mention path autocomplete (real cwd)", () => {
  async function openSessionWithChat(page, sessionsDir, testInfo) {
    const cwd = seedCwd();
    const { entries } = buildSession({ cwd });
    const name = uniqueSessionName(testInfo, "mention");
    const id = writeSession(sessionsDir, name, entries);

    await collapseScratchpad(page);
    await page.goto(`/session?id=${encodeURIComponent(id)}`);

    const composer = page.locator("#pi-chat-composer");
    await expect(composer).toHaveAttribute("data-chat-available", "true");
    return page.locator("#pi-chat-message");
  }

  test("opens on '@' and lists files and folders", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const textarea = await openSessionWithChat(page, sessionsDir, testInfo);

    await textarea.fill("@");

    const popup = page.locator("#pi-chat-mention-popup");
    await expect(popup).toBeVisible();
    // An empty query lists only the immediate (top-level) children — app.js,
    // app.test.js, README.md, lib/ (dir) — and never recurses into lib/, so
    // lib/util.js is absent. Four entries.
    await expect(page.locator("#pi-chat-mention-popup .slash-item")).toHaveCount(4);
    await expect(
      page.locator('#pi-chat-mention-popup .slash-item[data-insert="lib"]'),
    ).toBeVisible();
    await expect(
      page.locator('#pi-chat-mention-popup .slash-item[data-insert="lib/util.js"]'),
    ).toHaveCount(0);
  });

  test("filters as the query narrows", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const textarea = await openSessionWithChat(page, sessionsDir, testInfo);

    await textarea.fill("@app");
    const items = page.locator("#pi-chat-mention-popup .slash-item");
    await expect(items).toHaveCount(2);
    await expect(
      page.locator('#pi-chat-mention-popup .slash-item[data-insert="README.md"]'),
    ).toHaveCount(0);
  });

  test("Enter inserts the selected file path and closes", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const textarea = await openSessionWithChat(page, sessionsDir, testInfo);

    await textarea.fill("@app");
    await expect(page.locator("#pi-chat-mention-popup .slash-item")).toHaveCount(2);

    await textarea.press("Enter");

    // app.js ranks first (both app.js and app.test.js are prefix matches; ties
    // break by path, and "app.js" < "app.test.js").
    await expect(textarea).toHaveValue("app.js ");
    await expect(page.locator("#pi-chat-mention-popup")).toBeHidden();
  });

  test("selecting a folder keeps the popup open with a scoped query", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const textarea = await openSessionWithChat(page, sessionsDir, testInfo);

    await textarea.fill("@lib");
    await page
      .locator('#pi-chat-mention-popup .slash-item[data-insert="lib"]')
      .click();

    await expect(textarea).toHaveValue("@lib/");
    // The popup stays open and now lists entries under lib/.
    await expect(page.locator("#pi-chat-mention-popup")).toBeVisible();
    await expect(
      page.locator('#pi-chat-mention-popup .slash-item[data-insert="lib/util.js"]'),
    ).toBeVisible();
  });

  test("Escape closes the popup", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const textarea = await openSessionWithChat(page, sessionsDir, testInfo);

    await textarea.fill("@");
    await expect(page.locator("#pi-chat-mention-popup")).toBeVisible();

    await textarea.press("Escape");
    await expect(page.locator("#pi-chat-mention-popup")).toBeHidden();
  });
});
