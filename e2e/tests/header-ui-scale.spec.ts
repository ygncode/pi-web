import { test, expect, collapseScratchpad } from "../lib/test";
import type { Page } from "@playwright/test";

// Phone header at every UI scale step ("tamanho da fonte", 80%–150%).
// The scale is CSS zoom on <html>, so 390px at 150% leaves only 260 CSS px
// for the header. Every header action — especially the + new-session button —
// must stay fully inside the viewport and not overlap its neighbours.

const SCALES = [80, 90, 100, 110, 120, 130, 140, 150];
const BUTTONS = [
  ".session-header-back",
  "#tree-toggle",
  ".session-header-projects",
  ".zc-theme-btn",
  ".session-header-schedules",
  "#new-session-header-btn",
  "#toggle-right-sidebar-btn",
  "#command-menu-btn",
];

async function openDemoSession(page: Page) {
  await collapseScratchpad(page);
  await page.goto("/");
  await page.locator(".session-card", { hasText: "add deepseek-v4-pro" }).click();
  await expect(page).toHaveURL(/\/session\?id=/);
  await page.locator(".session-header-bar").waitFor();
}

test.describe("session header at 390px across UI scales", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const scale of SCALES) {
    test(`all header buttons visible at ${scale}%`, async ({ page }) => {
      await openDemoSession(page);
      await page.evaluate((v) => {
        const root = document.documentElement;
        if (v === 100) {
          delete root.dataset.uiScale;
          root.style.removeProperty("zoom");
        } else {
          root.dataset.uiScale = String(v);
          root.style.zoom = String(v / 100);
        }
        window.dispatchEvent(new Event("resize"));
      }, scale);
      // Worst case on the multi-user hub: a colleague's session shows a long
      // owner badge in the right cluster. Inject one when the server isn't in
      // multi-user mode so the budget always includes it.
      await page.evaluate(() => {
        const right = document.querySelector(".session-header-right");
        if (right && !right.querySelector(".session-owner-badge")) {
          const badge = document.createElement("span");
          badge.className = "session-owner-badge others";
          badge.textContent = "de Henrique Fiuza · claude-code";
          right.prepend(badge);
        }
      });
      await page.waitForTimeout(100);

      const viewport = page.viewportSize()!;
      const boxes: { sel: string; x: number; r: number }[] = [];
      for (const sel of BUTTONS) {
        const loc = page.locator(`.session-header-bar ${sel}`).first();
        await expect(loc, `${sel} at ${scale}%`).toBeVisible();
        const b = (await loc.boundingBox())!;
        expect(b.width, `${sel} width at ${scale}%`).toBeGreaterThanOrEqual(20);
        expect(b.x, `${sel} left edge at ${scale}%`).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width, `${sel} right edge at ${scale}%`).toBeLessThanOrEqual(
          viewport.width + 0.5,
        );
        boxes.push({ sel, x: b.x, r: b.x + b.width });
      }
      // No two buttons overlap horizontally (they share one row).
      const sorted = [...boxes].sort((a, b) => a.x - b.x);
      for (let i = 1; i < sorted.length; i++) {
        expect(
          sorted[i].x,
          `${sorted[i].sel} overlaps ${sorted[i - 1].sel} at ${scale}%`,
        ).toBeGreaterThanOrEqual(sorted[i - 1].r - 0.5);
      }
      // The + button is really clickable (not covered by title/badge).
      const plus = (await page.locator("#new-session-header-btn").boundingBox())!;
      const hit = await page.evaluate(
        ([x, y]) => document.elementFromPoint(x, y)?.closest("#new-session-header-btn") != null,
        [plus.x + plus.width / 2, plus.y + plus.height / 2],
      );
      expect(hit, `+ button hit-test at ${scale}%`).toBe(true);
      if (process.env.HEADER_SHOT_DIR) {
        await page.screenshot({
          path: `${process.env.HEADER_SHOT_DIR}/header-${scale}.png`,
          clip: { x: 0, y: 0, width: viewport.width, height: 80 },
        });
      }
    });
  }
});
