import { test, expect, collapseScratchpad } from "../lib/test";
import { uniqueSessionName, writeSession } from "../lib/sessions";

// Build a session large enough to cross the server-side truncation threshold.
// The e2e server lowers that threshold via env vars (lib/server.ts:
// PI_WEB_LARGE_SESSION_THRESHOLD=100, PI_WEB_LARGE_SESSION_TAIL_ENTRIES=50) so
// this spec exercises the exact pagination path with a small session that
// renders instantly — earlier it used 1600 messages and flaked under parallel
// CPU contention because each load re-renders the whole conversation. Keep
// MESSAGE_COUNT above the threshold and EARLY_INDEX outside the embedded tail.
const MESSAGE_COUNT = 150; // + 1 header => 151 entries, > 100 threshold
const EARLY_INDEX = 5; // an early message, well outside the embedded tail (50)
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
  // This test does a user-triggered mid-flight fetch + re-render, so it's the
  // canary for transient resource starvation during the full parallel matrix:
  // 8+ browsers, the Node runner, and one shared pi-web server all competing for
  // CPU can delay even the poll's own execution past a fixed timeout, despite the
  // session being tiny. Two mitigations, both needed:
  //   1. A small session (env-lowered thresholds) so the work itself is cheap.
  //   2. Per-test retries to absorb rare contention spikes — a real regression
  //      still fails every attempt, so this hides timing flakes, not bugs.
  test.describe.configure({ retries: 2 });

  const WINDOW_TIMEOUT = 15_000;

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
    await expect(banner).toBeVisible({ timeout: WINDOW_TIMEOUT });
    await expect(banner).toContainText(/Showing latest .* of .* messages/);

    // The early message is outside the embedded tail, so it is not rendered yet.
    await expect(page.locator("#messages")).not.toContainText(EARLY_MARKER);

    // Click through preceding windows until everything is loaded. The banner
    // re-enables its button between windows and removes itself once `from`
    // reaches 0 (LoadEarlier.svelte). Playwright's click() auto-waits for the
    // enabled state, so we don't assert it separately. We deliberately avoid a
    // hard intermediate poll: under the full parallel matrix the synchronous
    // re-render of the merged conversation can briefly jam the main thread and
    // blow a fixed poll budget even though the load itself succeeded. The settle
    // below is best-effort; only the final state (banner gone + earliest message
    // rendered) is asserted, via auto-retrying locator assertions that absorb
    // that jam.
    for (let i = 0; i < 6 && (await banner.count()) > 0; i += 1) {
      await banner.getByRole("button").click();
      // Wait for this window to settle (button re-enabled or banner detached)
      // so the next iteration targets a ready control. Non-fatal — the final
      // assertions are authoritative.
      await page
        .waitForFunction(
          () => {
            const b = document.querySelector("#load-earlier-banner");
            const btn = b?.querySelector("button");
            return !b || (btn != null && !(btn as HTMLButtonElement).disabled);
          },
          { timeout: WINDOW_TIMEOUT },
        )
        .catch(() => {});
    }

    await expect(page.locator("#load-earlier-banner")).toHaveCount(0, {
      timeout: WINDOW_TIMEOUT,
    });

    // After all earlier windows load, the earliest message must actually be
    // rendered in the conversation view — not just merged into the data model.
    await expect(page.locator("#messages")).toContainText(EARLY_MARKER, {
      timeout: WINDOW_TIMEOUT,
    });
  });
});
