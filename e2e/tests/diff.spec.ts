import { test, expect } from "../lib/test";
import { buildSession, realWorkingDir, uniqueSessionName, writeSession } from "../lib/sessions";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "@playwright/test";

// The diff viewer (@pierre/diffs) ships a heavy shiki + worker renderer. Verify
// the actual rendering on Chromium only; cross-browser worker/highlighter
// behavior is out of scope for this feature's coverage and prone to flake.
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "diff renderer is verified on Chromium only",
);

/** A temp git repo with one committed file, an uncommitted edit, and an untracked file. */
function gitRepoWithChanges(): string {
  const dir = mkdtempSync(join(tmpdir(), "pi-web-e2e-gitdiff-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "pipe" });
  git("init", "-q");
  git("config", "user.email", "t@e2e.test");
  git("config", "user.name", "E2E");
  writeFileSync(join(dir, "hello.txt"), "line one\nline two\nline three\n");
  git("add", "hello.txt");
  git("commit", "-q", "-m", "add hello");
  writeFileSync(join(dir, "hello.txt"), "line one\nCHANGED two\nline three\n");
  writeFileSync(join(dir, "newfile.txt"), "fresh content\nsecond line\n");
  return dir;
}

async function waitSessionReady(page: Page) {
  await page.locator("#tree-container .tree-node").first().waitFor({ state: "attached" });
}

async function openDiffModal(page: Page) {
  await waitSessionReady(page);
  await page.locator("#command-menu-btn").click();
  await page.locator('#command-menu-popover [data-action="diff"]').click();
  await expect(page.locator(".diff-toolbar")).toBeVisible();
}

test.describe("diff review modal", () => {
  test("renders the working-tree diff full-page with a split/unified toggle", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const { entries } = buildSession({ cwd: gitRepoWithChanges() });
    const name = uniqueSessionName(testInfo, "diff");
    writeSession(sessionsDir, name, entries);

    await page.goto(`/session?id=${encodeURIComponent(name)}`);
    await openDiffModal(page);

    // The renderer mounts a <diffs-container> custom element per file once the
    // diff + highlighter finish loading.
    await expect(page.locator(".diff-codeview diffs-container").first()).toBeVisible({
      timeout: 15000,
    });

    // The sheet should fill the viewport, not sit as a small centered dialog.
    const panel = page.locator(".diff-sheet-panel");
    const box = await panel.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && box.width).toBeGreaterThan(viewport!.width * 0.95);
    expect(box && viewport && box.height).toBeGreaterThan(viewport!.height * 0.95);

    // Toggle to unified and confirm the renderer is still present.
    await page.locator(".diff-toggle-btn", { hasText: "Unified" }).click();
    await expect(page.locator(".diff-codeview diffs-container").first()).toBeVisible();
  });

  test("shows a not-a-repo message when the session cwd is not a git repo", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const { entries } = buildSession({ cwd: realWorkingDir() });
    const name = uniqueSessionName(testInfo, "diffnorepo");
    writeSession(sessionsDir, name, entries);

    await page.goto(`/session?id=${encodeURIComponent(name)}`);
    await openDiffModal(page);

    await expect(page.locator(".diff-status")).toContainText("Not a git repository");
  });

  test("loads a persisted comment and submits the review into the composer", async ({
    page,
    sessionsDir,
    baseURL,
  }, testInfo) => {
    const { entries } = buildSession({ cwd: gitRepoWithChanges() });
    const name = uniqueSessionName(testInfo, "diffreview");
    writeSession(sessionsDir, name, entries);

    // Seed a review comment through the API the modal reads from.
    const res = await page.request.post(
      `${baseURL}/api/diff/reviews?session=${encodeURIComponent(name)}`,
      { data: { file: "hello.txt", startLine: 2, endLine: 2, side: "new", body: "please revert this" } },
    );
    expect(res.ok()).toBeTruthy();

    await page.goto(`/session?id=${encodeURIComponent(name)}`);
    await openDiffModal(page);
    await expect(page.locator(".diff-codeview diffs-container").first()).toBeVisible({
      timeout: 15000,
    });

    // The seeded comment renders inside the diff's shadow DOM.
    const container = page.locator(".diff-codeview diffs-container").first();
    await expect(container.locator("text=please revert this")).toBeVisible();

    // Submitting composes the comment into the chat composer.
    await page.locator(".diff-submit").click();
    await expect(page.locator("#pi-chat-message")).toHaveValue(/please revert this/);
    await expect(page.locator(".diff-toolbar")).toBeHidden();
  });
});
