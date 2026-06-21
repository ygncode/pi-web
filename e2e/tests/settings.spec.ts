import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "../lib/test";
import { STATE_FILE, type ServerState } from "../lib/paths";

function writeCustomThemeFixture() {
  const state = JSON.parse(readFileSync(STATE_FILE, "utf8")) as ServerState;
  const webDir = join(state.agentDir, "pi-web");
  mkdirSync(webDir, { recursive: true });
  const css = [
    `[data-theme="custom"] {`,
    `  --body-bg: rgb(1, 2, 3);`,
    `  --surface: rgb(4, 5, 6);`,
    `  --text: rgb(240, 241, 242);`,
    `}`,
  ].join("\n");
  writeFileSync(join(webDir, "custom-themes.css"), css);
}

const LAYOUT = '[data-setting="pi-sessions:view-layout"]';
// Isolated setting that nothing else asserts on, so the round-trip can mutate
// shared server-side state without affecting other specs.
const SPINNER = '[data-setting="pi-sessions:spinner-style"]';

// The sidebar nav replaces the old single-stack layout: each section is hidden
// until its sidebar entry is clicked. On mobile the click also drills into the
// pane view; on desktop the active section is already shown but clicking is a
// no-op, so calling this unconditionally keeps the tests viewport-agnostic.
async function openSection(page: import("@playwright/test").Page, id: string) {
  await page.locator(`[data-settings-nav="${id}"]`).click();
}

test.describe("settings page", () => {
  test("loads with controls", async ({ page }) => {
    await page.goto("/settings");
    await openSection(page, "sessionsList");
    await expect(page.locator(LAYOUT)).toBeVisible();
  });

  test("loads and applies a custom theme stylesheet", async ({ page }) => {
    writeCustomThemeFixture();

    const css = await page.request.get("/custom-themes.css");
    expect(css.ok()).toBeTruthy();
    expect(css.headers()["content-type"]).toContain("text/css");
    expect(await css.text()).toContain(`--body-bg: rgb(1, 2, 3)`);

    await page.goto("/settings");
    await openSection(page, "appearance");
    const select = page.locator('[data-setting="pi-web-theme"]');
    await expect(select).toBeVisible();

    if ((await select.inputValue()) === "custom") {
      const savedDark = page.waitForResponse(
        (r) =>
          r.url().includes("/api/settings") && r.request().method() === "POST",
      );
      await select.selectOption("dark");
      await savedDark;
    }

    const savedCustom = page.waitForResponse(
      (r) =>
        r.url().includes("/api/settings") && r.request().method() === "POST",
    );
    await select.selectOption("custom");
    await savedCustom;

    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe("custom");
    await expect
      .poll(() =>
        page.evaluate(() => getComputedStyle(document.body).backgroundColor),
      )
      .toBe("rgb(1, 2, 3)");
  });

  // Settings persist in one global server-side store; running this on all 7
  // projects in parallel would race on the same key. Persistence is
  // browser-independent, so verify it on a single project.
  test("persists a setting server-side across reload", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "Desktop Chrome",
      "server-side persistence is browser-independent; run once",
    );

    await page.goto("/settings");
    await openSection(page, "sessionsList");
    const select = page.locator(SPINNER);
    await expect(select).toBeVisible();

    const current = await select.inputValue();
    const next = current === "runcat" ? "braille" : "runcat";

    // Changing the control writes through to the server via POST /api/settings.
    const saved = page.waitForResponse(
      (r) =>
        r.url().includes("/api/settings") && r.request().method() === "POST",
    );
    await select.selectOption(next);
    await saved;

    // Drop the local cache so the reloaded value can only come from the server.
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    // Reload returns to the default (Appearance) pane; re-enter Sessions List
    // before asserting the round-tripped value.
    await openSection(page, "sessionsList");
    await expect(page.locator(SPINNER)).toHaveValue(next);
  });

  // Alignment: all form controls in the settings control column must share the
  // same rendered width so the column has consistent left and right edges.
  test("form controls share a uniform width", async ({ page }, testInfo) => {
    // Run only on Desktop Chrome — layout is visual, browser-independent, and
    // a single representative viewport (1280×720) is enough.
    test.skip(
      testInfo.project.name !== "Desktop Chrome",
      "visual alignment check runs on one project",
    );

    await page.goto("/settings");
    await openSection(page, "sessionsList");
    await expect(page.locator(LAYOUT)).toBeVisible();

    // Collect bounding-box widths of every select, number, and time input that
    // sits inside a .settings-control.
    const widths: number[] = await page.evaluate(() => {
      const controls = document.querySelectorAll<HTMLElement>(
        ".settings-control select, .settings-control input[type='number'], .settings-control input[type='time']",
      );
      return Array.from(controls).map((el) =>
        Math.round(el.getBoundingClientRect().width),
      );
    });

    expect(widths.length).toBeGreaterThan(0);

    // All controls must be the same width (uniform column).
    const first = widths[0];
    for (const w of widths) {
      expect(w).toBe(first);
    }
  });

  // Alignment: on narrow viewports (≤560px) rows must stack vertically so the
  // label and control don't compete for horizontal space.
  test("rows stack vertically on narrow viewports", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "Desktop Chrome",
      "responsive stacking check runs on one project",
    );

    await page.setViewportSize({ width: 400, height: 800 });
    await page.goto("/settings");
    await openSection(page, "sessionsList");
    await expect(page.locator(LAYOUT)).toBeVisible();

    const flexDirection = await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>(".settings-row");
      return row ? getComputedStyle(row).flexDirection : null;
    });

    expect(flexDirection).toBe("column");
  });

  // Regression: AppearanceSettings used to write $state while computing the font
  // <select> value during render. With a custom font configured, that throws
  // svelte state_unsafe_mutation when the component mounts during a client-side
  // route swap (not a fresh page load), blanking the settings page. Direct loads
  // happened to be safe, so this only reproduces via in-app navigation.
  test("client-side nav to settings is safe with a custom font set", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // A custom font (not a builtin) must be the active value when AppearanceSettings
    // mounts during the route swap — that's when its font-select renders inside an
    // {#each} block effect, where the old code wrote $state. Serve it from settings
    // hydration so the value survives (a localStorage-only seed gets overwritten by
    // hydration before we navigate).
    await page.route("**/api/settings", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          json: { settings: { "pi-web:v1:font-ui": "Comic Sans MS" } },
        });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });

    await page.goto("/");
    await expect(page.locator("[data-sessions-content]")).toBeVisible();

    // Navigate to settings client-side (Cmd+,), not a full page load.
    await page.keyboard.press("Meta+Comma");

    // The swap must complete: the settings page renders instead of blanking, and
    // no state_unsafe_mutation is thrown computing the font <select> value.
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.locator(".session-header-title")).toHaveText("Settings");
    expect(errors.filter((m) => /state_unsafe_mutation/.test(m))).toEqual([]);
  });

  // Sidebar navigation: clicking a section in the left nav swaps the visible
  // pane. Only one section component is mounted at a time, so controls from
  // other sections must be absent until their entry is clicked.
  test("sidebar swaps section pane on click", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "Desktop Chrome",
      "sidebar swap is viewport-agnostic on desktop; run once",
    );

    await page.goto("/settings");
    // Appearance is the default pane; the theme control proves it.
    await expect(page.locator('[data-setting="pi-web-theme"]')).toBeVisible();
    await expect(page.locator(LAYOUT)).toHaveCount(0);

    await page.locator('[data-settings-nav="sessionsList"]').click();
    await expect(page.locator(LAYOUT)).toBeVisible();
    await expect(page.locator('[data-setting="pi-web-theme"]')).toHaveCount(0);
  });

  // Session Display defaults (issue #48). Three tests cover the feature end
  // to end: the /settings page round-trip, the bug-fix invariant that an
  // in-session toggle is scoped to that session id, and the migration that
  // discards the pre-PR global blob. They share a key (toggle:thinking) and
  // assume specific server-side starting state, so they run serially in the
  // same worker (the file is fullyParallel by default — see playwright.config).
  test.describe.serial("session display defaults", () => {
    // POST the toggle defaults back to the server-side defaults before each
    // test in this group so a partial earlier run can't make the next test
    // depend on stale state.
    test.beforeEach(async ({ page }, testInfo) => {
      test.skip(
        testInfo.project.name !== "Desktop Chrome",
        "shared server-side settings store; run once",
      );
      const r = await page.request.post("/api/settings", {
        data: {
          settings: {
            "pi-web:v1:toggle:thinking": "true",
            "pi-web:v1:toggle:tools": "true",
            "pi-web:v1:toggle:tool-outputs": "false",
          },
        },
      });
      expect(r.ok()).toBeTruthy();
    });

    // /settings round-trip: the three header toggles (thinking, tools, tool
    // outputs) have configurable initial visibility. The /settings page writes
    // through to /api/settings, and the next session load picks the new value
    // up via loadToggleState before the user has touched the header buttons.
    // Verified by checking the buttons' aria-pressed state, which
    // syncToggleButtons sets on attachHeaderHandlers.
    test("defaults persist and apply to new session loads", async ({
      page,
    }) => {
      const thinkingInput = '[data-setting="pi-web:v1:toggle:thinking"]';
      // The <input> is visually hidden by .settings-toggle CSS; the wrapping
      // <label> is what the user actually clicks. Target the label for
      // interactions and the input for state assertions.
      const thinkingLabel = `label.settings-toggle:has(${thinkingInput})`;

      await page.goto("/settings");
      await openSection(page, "sessionDisplay");
      await expect(page.locator(thinkingLabel)).toBeVisible();
      await expect(page.locator(thinkingInput)).toBeChecked();

      // Default is "true" (matches the previous hardcoded behavior); flip to
      // off and assert the change is POSTed.
      const saved = page.waitForResponse(
        (r) =>
          r.url().includes("/api/settings") &&
          r.request().method() === "POST",
      );
      await page.locator(thinkingLabel).click();
      await saved;
      await expect(page.locator(thinkingInput)).not.toBeChecked();

      // Drop the localStorage cache so the next page load can only get the
      // setting back from the server, then reload to confirm it stays off.
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();
      await openSection(page, "sessionDisplay");
      await expect(page.locator(thinkingInput)).not.toBeChecked();

      // Open the demo session and assert the header toggle reflects the new
      // default. aria-pressed is set by syncToggleButtons during
      // attachHeaderHandlers, so it captures the state loadToggleState
      // computed.
      await page.goto("/");
      await page
        .locator(".session-card", { hasText: "add deepseek-v4-pro" })
        .click();
      await expect(page).toHaveURL(/\/session\?id=/);
      await expect(
        page.locator('[data-action="toggle-thinking"]'),
      ).toHaveAttribute("aria-pressed", "false");
    });

    // Per-session override (issue #48 follow-up): when the user toggles a
    // header button inside a session, the override is scoped to that session.
    // Other sessions still follow the configured /settings default. Regression
    // guard for the bug where a single global blob shadowed the setting across
    // every session.
    test("in-session header toggle override is scoped to that session", async ({
      page,
    }) => {
      // Clean any blob a previous test in this group might have left on this
      // browser context. The beforeEach has reset server-side defaults.
      await page.goto("/");
      await page.evaluate(() =>
        window.localStorage.removeItem("pi.sessionDetail.toggleState"),
      );

      // Open the demo session and toggle thinking off via the header button —
      // this is the "in-session override" the bug used to leak to every other
      // session.
      await page
        .locator(".session-card", { hasText: "add deepseek-v4-pro" })
        .click();
      await expect(page).toHaveURL(/\/session\?id=/);
      const demoUrl = page.url();
      await expect(
        page.locator('[data-action="toggle-thinking"]'),
      ).toHaveAttribute("aria-pressed", "true");
      await page.locator('[data-action="toggle-thinking"]').click();
      await expect(
        page.locator('[data-action="toggle-thinking"]'),
      ).toHaveAttribute("aria-pressed", "false");

      // Navigate to a different session; the configured default (thinking on)
      // must apply — the demo override must not leak.
      await page.goto("/");
      await page
        .locator(".session-card", { hasText: "Fix the failing unit test" })
        .click();
      await expect(page).toHaveURL(/\/session\?id=/);
      await expect(
        page.locator('[data-action="toggle-thinking"]'),
      ).toHaveAttribute("aria-pressed", "true");

      // Re-open the demo session; the per-session override must still apply
      // there (the blob remembers it specifically for that session id).
      await page.goto(demoUrl);
      await expect(
        page.locator('[data-action="toggle-thinking"]'),
      ).toHaveAttribute("aria-pressed", "false");
    });

    // Migration: a pre-existing flat-state blob (one shared override for every
    // session) must be ignored after this PR so the configured default
    // applies. Regression guard for the exact bug surfaced in the screenshot
    // review.
    test("stale flat-shape toggle blob is ignored by loadToggleState", async ({
      page,
    }) => {
      // Seed localStorage with the old flat shape before any session loads,
      // matching what users from before this PR have on their machines.
      await page.goto("/");
      await page.evaluate(() => {
        window.localStorage.setItem(
          "pi.sessionDetail.toggleState",
          JSON.stringify({
            thinkingExpanded: false,
            toolsVisible: false,
            toolOutputsExpanded: true,
          }),
        );
      });
      await page
        .locator(".session-card", { hasText: "add deepseek-v4-pro" })
        .click();
      await expect(page).toHaveURL(/\/session\?id=/);

      // The configured defaults (thinking on, tools on, tool outputs off) must
      // win — the flat blob is treated as no overrides.
      await expect(
        page.locator('[data-action="toggle-thinking"]'),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        page.locator('[data-action="toggle-tools"]'),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        page.locator('[data-action="toggle-tool-output"]'),
      ).toHaveAttribute("aria-pressed", "false");
    });

    // Gating: while tool calls are hidden, the "Tool output" header button and
    // its matching settings toggle have no visible effect, so both must
    // surface as disabled. The state itself is preserved so re-enabling tools
    // restores the prior tool-output choice.
    test("tool-output toggle is disabled while tools are hidden", async ({
      page,
    }) => {
      // Session header: open demo, hide tools, assert the Tool output button is
      // disabled; show tools again, assert it's re-enabled.
      await page.goto("/");
      await page
        .locator(".session-card", { hasText: "add deepseek-v4-pro" })
        .click();
      await expect(page).toHaveURL(/\/session\?id=/);
      const toolOutputBtn = page.locator(
        '[data-action="toggle-tool-output"]',
      );
      await expect(toolOutputBtn).toBeEnabled();
      await page.locator('[data-action="toggle-tools"]').click();
      await expect(toolOutputBtn).toBeDisabled();
      await page.locator('[data-action="toggle-tools"]').click();
      await expect(toolOutputBtn).toBeEnabled();

      // Settings page: same gating on the "Expand tool outputs by default"
      // input — disabled when "Show tool calls by default" is off.
      await page.goto("/settings");
      await openSection(page, "sessionDisplay");
      const toolsInput = page.locator(
        '[data-setting="pi-web:v1:toggle:tools"]',
      );
      const toolOutputsInput = page.locator(
        '[data-setting="pi-web:v1:toggle:tool-outputs"]',
      );
      const toolsLabel = `label.settings-toggle:has([data-setting="pi-web:v1:toggle:tools"])`;
      await expect(toolsInput).toBeChecked();
      await expect(toolOutputsInput).toBeEnabled();
      const offSaved = page.waitForResponse(
        (r) =>
          r.url().includes("/api/settings") &&
          r.request().method() === "POST",
      );
      await page.locator(toolsLabel).click();
      await offSaved;
      await expect(toolOutputsInput).toBeDisabled();
    });

    // Hiding tools must leave a visible marker next to each tool call, not a
    // stranded timestamp. Mirrors the .thinking-collapsed "Thinking ..."
    // placeholder pattern.
    test("hiding tools surfaces the 'Tool: <name> ...' collapsed marker", async ({
      page,
    }) => {
      await page.goto("/");
      await page
        .locator(".session-card", { hasText: "add deepseek-v4-pro" })
        .click();
      await expect(page).toHaveURL(/\/session\?id=/);

      // Default state: tools visible, placeholder hidden.
      await expect(
        page.locator('[data-action="toggle-tools"]'),
      ).toHaveAttribute("aria-pressed", "true");
      const placeholders = page.locator(".tool-call-collapsed");
      await expect(placeholders.first()).toBeAttached();
      await expect(placeholders.first()).toBeHidden();
      await expect(page.locator(".tool-execution").first()).toBeVisible();

      // Toggle tools off and assert the swap — placeholder becomes visible,
      // tool-execution is hidden.
      await page.locator('[data-action="toggle-tools"]').click();
      await expect(placeholders.first()).toBeVisible();
      await expect(placeholders.first()).toContainText(/^Tool: \S+ \.\.\./);
      await expect(page.locator(".tool-execution").first()).toBeHidden();
    });
  });

  // Mobile drill-in: at narrow widths the sidebar fills the viewport and the
  // pane is hidden until a section is tapped; the header back arrow returns to
  // the list. Mirrors the iOS Settings pattern.
  test("mobile drill-in shows list, then pane, then list", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "Desktop Chrome",
      "mobile layout is viewport-driven, not browser-specific; run once",
    );

    await page.setViewportSize({ width: 400, height: 800 });
    await page.goto("/settings");

    // List view: sidebar items visible, pane (and its mounted default section)
    // hidden by CSS until the user drills in.
    await expect(
      page.locator('[data-settings-nav="appearance"]'),
    ).toBeVisible();
    await expect(page.locator(".settings-pane")).toBeHidden();
    await expect(page.locator(".session-header-title")).toHaveText("Settings");

    // Drill into Appearance: pane content shows, sidebar hides, header swaps.
    await page.locator('[data-settings-nav="appearance"]').click();
    await expect(page.locator('[data-setting="pi-web-theme"]')).toBeVisible();
    await expect(page.locator(".settings-sidebar")).toBeHidden();
    await expect(page.locator(".session-header-title")).toHaveText(
      "Appearance",
    );

    // Header back returns to the list.
    await page.locator(".session-header-back").click();
    await expect(
      page.locator('[data-settings-nav="appearance"]'),
    ).toBeVisible();
    await expect(page.locator(".settings-pane")).toBeHidden();
    await expect(page.locator(".session-header-title")).toHaveText("Settings");
  });
});
