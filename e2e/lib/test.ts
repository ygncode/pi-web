import { readFileSync } from "node:fs";
import { test as base, expect } from "@playwright/test";
import { STATE_FILE, type ServerState } from "./paths";

function readState(): ServerState {
  return JSON.parse(readFileSync(STATE_FILE, "utf8"));
}

interface Fixtures {
  /** Absolute path to the temp sessions dir the server watches (for mutating tests). */
  sessionsDir: string;
}

export const test = base.extend<Fixtures>({
  // Override baseURL from the running server discovered in global-setup.
  baseURL: async ({}, use) => {
    await use(readState().baseURL);
  },
  sessionsDir: async ({}, use) => {
    await use(readState().sessionsDir);
  },
  // Belt-and-suspenders for the cat gatekeeper: global-setup disables it
  // server-side, but settings hydrate asynchronously, so also set localStorage
  // before any page script runs to cover the synchronous pre-hydration read.
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("pi-web:v1:cat:enabled", "false");
      } catch {
        /* ignore */
      }
    });
    await use(page);
  },
});

/**
 * Resolve the active layout at runtime. Layout follows the 900px breakpoint,
 * not the device type — iPad portrait (810px) is mobile, landscape (~1080px)
 * is desktop — so callers must check this AFTER navigating to a real page
 * (matchMedia on about:blank does not reflect the project viewport).
 */
export async function isMobileLayout(
  page: import("@playwright/test").Page,
): Promise<boolean> {
  return page.evaluate(() => window.matchMedia("(max-width: 900px)").matches);
}

/**
 * Start with the scratchpad (right sidebar) collapsed. On narrow viewports it
 * otherwise overlays the header/composer and intercepts clicks. Must be called
 * before navigating (it installs an init script read by the page's bootstrap).
 */
export async function collapseScratchpad(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("pi-web:v1:right-sidebar-collapsed", "true");
    } catch {
      /* ignore */
    }
  });
}

export { expect };
