import type { Page } from "@playwright/test";

/**
 * Suspend the browser-local cleanup that removes steer chips when the session
 * reloads. The stub pi echoes a steer immediately, so a normal reload can
 * remove the chip before a screenshot or assertion observes it.
 *
 * Returns a release callback that reenables cleanup and replays a reload event.
 */
export async function suspendSteerChipCleanup(
  page: Page,
): Promise<() => Promise<void>> {
  await page.evaluate(() => {
    const w = window as Window & {
      __piSuspendChipCleanup?: boolean;
      __piOriginalDispatch?: typeof window.dispatchEvent;
    };
    if (w.__piOriginalDispatch) {
      w.__piSuspendChipCleanup = true;
      return;
    }
    w.__piSuspendChipCleanup = true;
    const original = window.dispatchEvent.bind(window);
    w.__piOriginalDispatch = original;
    window.dispatchEvent = function (event: Event) {
      if (
        w.__piSuspendChipCleanup &&
        (event.type === "pi-session-reload" || event.type === "pi-worker-done")
      ) {
        return true;
      }
      return original(event);
    };
  });
  return async () => {
    await page.evaluate(() => {
      const w = window as Window & { __piSuspendChipCleanup?: boolean };
      w.__piSuspendChipCleanup = false;
      window.dispatchEvent(new Event("pi-session-reload"));
    });
  };
}
