import { test, expect, collapseScratchpad } from "../lib/test";
import { uniqueSessionName, writeSession } from "../lib/sessions";

// Build a session large enough to cross the server-side truncation threshold
// (internal/ui/session_page.go: LargeSessionThreshold = 1500). The initial HTML
// render then embeds only the tail (LargeSessionTailEntries = 1000) and the
// frontend shows a "Load earlier" banner that lazily fetches preceding windows
// via /api/session?id=...&from=N&count=K.
const MESSAGE_COUNT = 1600; // + 1 header => 1601 entries, > 1500 threshold
const EARLY_INDEX = 5; // an early message, well outside the embedded tail
const EARLY_MARKER = "EARLY_MARKER_LOADME";

function buildLargeSession(): unknown[] {
  const cwd = "/home/user/demo-project";
  const base = Date.parse("2026-05-06T00:00:00.000Z");
  const ts = (i: number) => new Date(base + i * 1000).toISOString();

  const entries: unknown[] = [
    { type: "session", version: 3, id: "019e0000-0000-7000-8000-000000000000", timestamp: ts(0), cwd },
  ];

  let parentId: string | null = null;
  for (let i = 0; i < MESSAGE_COUNT; i += 1) {
    const id = `m${String(i).padStart(6, "0")}`;
    const role = i % 2 === 0 ? "user" : "assistant";
    const text = i === EARLY_INDEX ? EARLY_MARKER : `message body ${i}`;
    entries.push({
      type: "message",
      id,
      parentId,
      timestamp: ts(i + 1),
      message: { role, content: [{ type: "text", text }], timestamp: base + (i + 1) * 1000 },
    });
    parentId = id;
  }
  return entries;
}

test.describe("load-earlier banner (large session pagination)", () => {
  test("truncated session loads earlier windows on demand", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    // On narrow viewports the scratchpad overlays content and can intercept
    // clicks; collapse it before navigating so the banner button is clickable.
    await collapseScratchpad(page);

    const name = uniqueSessionName(testInfo, "le");
    const id = writeSession(sessionsDir, name, buildLargeSession());

    await page.goto(`/session?id=${encodeURIComponent(id)}`);

    const banner = page.locator("#load-earlier-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/Showing latest .* of .* messages/);

    // The early message is outside the embedded tail, so it is not rendered yet.
    await expect(page.locator("#messages")).not.toContainText(EARLY_MARKER);

    // Click through preceding windows until everything is loaded. The banner
    // removes itself once `from` reaches 0 (load-earlier.js).
    const button = banner.getByRole("button");
    for (let i = 0; i < 6 && (await banner.count()) > 0; i += 1) {
      await expect(button).toBeEnabled();
      await button.click();
      // Either the banner is gone, or it re-enabled for the next window.
      await expect
        .poll(async () =>
          (await banner.count()) === 0 || (await button.isEnabled()),
        )
        .toBe(true);
    }

    await expect(page.locator("#load-earlier-banner")).toHaveCount(0);

    // After all earlier windows load, the earliest message must actually be
    // rendered in the conversation view — not just merged into the data model.
    await expect(page.locator("#messages")).toContainText(EARLY_MARKER);
  });
});
