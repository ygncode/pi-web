import { test, expect } from "../lib/test";

// The active locale is resolved synchronously from localStorage
// (pi-web:v1:locale) at first render — see web/src/shared/i18n.js getLocale().
// Seeding it via an init script before navigation drives the rendered language
// per browser-context WITHOUT mutating the shared server-side settings store,
// so these specs stay isolated from every other test in the run.
async function setLocale(
  page: import("@playwright/test").Page,
  code: string,
): Promise<void> {
  await page.addInitScript((loc) => {
    try {
      localStorage.setItem("pi-web:v1:locale", loc);
    } catch {
      /* ignore */
    }
  }, code);
}

test.describe("i18n", () => {
  // Translations are baked into the rendered DOM and are browser-independent,
  // so a single representative project is enough.
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "Desktop Chrome",
      "rendered translations are browser-independent; run once",
    );
  });

  test("renders the settings page in the selected locale", async ({ page }) => {
    await setLocale(page, "es");
    await page.goto("/settings");

    // Header title + first section title come straight from t().
    await expect(page.locator(".settings-header h1")).toHaveText("Ajustes");
    await expect(page.locator(".settings-section-title").first()).toHaveText(
      "Apariencia",
    );
    // A label deeper in the form proves the extracted section components
    // (not just the page shell) resolve through t().
    await expect(
      page.locator(".settings-row-label .name", { hasText: "Idioma" }).first(),
    ).toBeVisible();
  });

  test("renders the sessions index in the selected locale", async ({ page }) => {
    await setLocale(page, "fr");
    await page.goto("/");

    // Layout toggle + search button are visible index chrome whose strings
    // differ from English, proving the index components resolve through t().
    await expect(page.locator('[data-layout-btn="timeline"]')).toHaveText(
      "Chronologie",
    );
    await expect(page.locator(".nav-search-btn")).toContainText(
      "Rechercher des sessions...",
    );
  });

  test("renders settings in a built-in ASEAN locale", async ({ page }) => {
    // Vietnamese is one of the 8 ASEAN built-ins; proves the new locale files
    // load and resolve through t().
    await setLocale(page, "vi");
    await page.goto("/settings");

    await expect(page.locator(".settings-header h1")).toHaveText("Cài đặt");
    await expect(page.locator(".settings-section-title").first()).toHaveText(
      "Giao diện",
    );
  });

  test("language picker lists every built-in locale", async ({ page }) => {
    await page.goto("/settings");

    // 6 original + 8 ASEAN built-ins must all be selectable.
    const codes = await page
      .locator("[data-setting-locale] option")
      .evaluateAll((opts) =>
        opts.map((o) => (o as HTMLOptionElement).value),
      );
    for (const code of [
      "en", "es", "fr", "de", "zh", "ja",
      "id", "ms", "vi", "th", "fil", "my", "km", "lo",
    ]) {
      expect(codes).toContain(code);
    }
  });

  test("falls back to English for the default locale", async ({ page }) => {
    // No init script: default locale is English.
    await page.goto("/settings");

    await expect(page.locator(".settings-header h1")).toHaveText("Settings");
    await expect(page.locator(".settings-section-title").first()).toHaveText(
      "Appearance",
    );
  });
});
