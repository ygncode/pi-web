import { test, expect, isMobileLayout, collapseScratchpad } from "../lib/test";
import { buildSession, realWorkingDir, uniqueSessionName, writeSession } from "../lib/sessions";

// Regression guard for the iOS "can't see the chat input box" bug: when the
// on-screen keyboard opens, mobile Safari shrinks the *visual* viewport but
// leaves the layout viewport full-height, which would slide the bottom-docked
// composer underneath the keyboard. The fix (session.js + session.css) pins the
// session shell with position:fixed and sizes it to --viewport-height, which the
// visualViewport handler keeps in sync; the composer is the bottom flex child of
// that fixed-height column, so it stays just above the keyboard.
//
// Playwright cannot summon a real virtual keyboard, so we reproduce its only
// observable effect — a shrunken --viewport-height — and assert the composer
// follows it instead of being buried. This catches the realistic regressions:
// the fixed/height wiring being dropped, or the composer escaping the column.

test.describe("composer stays above the keyboard (mobile)", () => {
  test("composer follows --viewport-height when the keyboard shrinks the viewport", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    // Chat must be available (cwd exists) so the composer textarea renders.
    const cwd = realWorkingDir();
    const { entries } = buildSession({ cwd });
    const name = uniqueSessionName(testInfo, "kbd");
    const id = writeSession(sessionsDir, name, entries);

    await collapseScratchpad(page);
    await page.goto(`/session?id=${encodeURIComponent(id)}`);

    test.skip(!(await isMobileLayout(page)), "mobile-only behavior");

    const composer = page.locator("#pi-chat-composer");
    await expect(composer).toHaveAttribute("data-chat-available", "true");

    const textarea = page.locator("#pi-chat-message");
    await expect(textarea).toBeVisible();

    // The fix hinges on the session shell being a fixed-height column.
    const bodyPosition = await page.evaluate(
      () => getComputedStyle(document.body).position,
    );
    expect(bodyPosition).toBe("fixed");

    // At rest the textarea sits within the layout viewport.
    const innerHeight = await page.evaluate(() => window.innerHeight);
    const restBottom = (await textarea.boundingBox())!.y + (await textarea.boundingBox())!.height;
    expect(restBottom).toBeLessThanOrEqual(innerHeight + 1);

    // Simulate the keyboard: the visualViewport handler sets --viewport-height
    // to the shrunken visible height. Mimic a ~320px keyboard.
    const keyboard = 320;
    const reduced = innerHeight - keyboard;
    await page.evaluate((h) => {
      document.documentElement.style.setProperty("--viewport-height", `${h}px`);
    }, reduced);

    // The composer must now sit within the reduced (visible) area, not below it.
    // A few px of tolerance for borders/sub-pixel rounding.
    await expect
      .poll(async () => {
        const box = (await textarea.boundingBox())!;
        return box.y + box.height;
      })
      .toBeLessThanOrEqual(reduced + 4);
  });
});
