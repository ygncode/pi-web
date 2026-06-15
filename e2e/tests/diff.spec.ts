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

/** A temp git repo where three consecutive lines (2-4) are modified. */
function gitRepoWithBlockChange(): string {
  const dir = mkdtempSync(join(tmpdir(), "pi-web-e2e-gitblock-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "pipe" });
  git("init", "-q");
  git("config", "user.email", "t@e2e.test");
  git("config", "user.name", "E2E");
  writeFileSync(join(dir, "block.txt"), "a\nb\nc\nd\ne\nf\n");
  git("add", "block.txt");
  git("commit", "-q", "-m", "add block");
  writeFileSync(join(dir, "block.txt"), "a\nB2\nC3\nD4\ne\nf\n");
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

  test("adds a comment from the gutter, persists it across reload, and submits it", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const { entries } = buildSession({ cwd: gitRepoWithChanges() });
    const name = uniqueSessionName(testInfo, "diffreview");
    writeSession(sessionsDir, name, entries);

    await page.goto(`/session?id=${encodeURIComponent(name)}`);
    await openDiffModal(page);
    const container = page.locator(".diff-codeview diffs-container").first();
    await expect(container).toBeVisible({ timeout: 15000 });

    // Hover the changed line, click the gutter "+", type a comment, and save.
    await container.getByText("CHANGED two").hover();
    await container.locator("button[data-utility-button]").first().click({ force: true });
    await container.locator("textarea").first().fill("please revert this");
    await container.getByRole("button", { name: "Save" }).click();
    await expect(container.locator("text=please revert this")).toBeVisible();

    // Reload the page and reopen — the comment was persisted server-side.
    await page.reload();
    await openDiffModal(page);
    const container2 = page.locator(".diff-codeview diffs-container").first();
    await expect(container2).toBeVisible({ timeout: 15000 });
    await expect(container2.locator("text=please revert this")).toBeVisible();

    // Submitting composes the comment into the chat composer.
    await page.locator(".diff-submit").click();
    await expect(page.locator("#pi-chat-message")).toHaveValue(/please revert this/);
    await expect(page.locator(".diff-toolbar")).toBeHidden();
  });

  test("re-themes the diff when the app theme changes", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const { entries } = buildSession({ cwd: gitRepoWithChanges() });
    const name = uniqueSessionName(testInfo, "difftheme");
    writeSession(sessionsDir, name, entries);

    await page.goto(`/session?id=${encodeURIComponent(name)}`);
    await openDiffModal(page);
    const container = page.locator(".diff-codeview diffs-container").first();
    await expect(container).toBeVisible({ timeout: 15000 });

    const colorScheme = () =>
      page.evaluate(
        () =>
          getComputedStyle(
            document.querySelector(".diff-codeview diffs-container") as HTMLElement,
          ).colorScheme,
      );

    await expect.poll(colorScheme).toBe("dark");
    await page.evaluate(() => (document.documentElement.dataset.theme = "light"));
    await expect.poll(colorScheme).toBe("light");
  });

  test("comments on a multi-line range selected by dragging the gutter", async ({
    page,
    sessionsDir,
    baseURL,
  }, testInfo) => {
    const { entries } = buildSession({ cwd: gitRepoWithBlockChange() });
    const name = uniqueSessionName(testInfo, "diffrange");
    writeSession(sessionsDir, name, entries);

    await page.goto(`/session?id=${encodeURIComponent(name)}`);
    await openDiffModal(page);
    // Unified gives a single line-number column, simplest to drag-select.
    await page.locator(".diff-toggle-btn", { hasText: "Unified" }).click();
    const container = page.locator(".diff-codeview diffs-container").first();
    await expect(container).toBeVisible({ timeout: 15000 });

    // Drag across the line-number gutter from line 2 to line 4 to select a range.
    const lineNumber = (n: number) => container.locator(`[data-column-number="${n}"]`).first();
    const top = await lineNumber(2).boundingBox();
    const bottom = await lineNumber(4).boundingBox();
    await page.mouse.move(top!.x + 12, top!.y + top!.height / 2);
    await page.mouse.down();
    await page.mouse.move(top!.x + 12, top!.y + top!.height, { steps: 3 });
    await page.mouse.move(bottom!.x + 12, bottom!.y + bottom!.height / 2, { steps: 12 });
    await page.mouse.up();
    // Nudge to surface the gutter "+" over the selection, then open the composer.
    await page.mouse.move(bottom!.x + 80, bottom!.y + bottom!.height / 2);
    await container.locator("button[data-utility-button]").first().click({ force: true });
    await container.locator("textarea").first().fill("address this whole block");
    await container.getByRole("button", { name: "Save" }).click();
    await expect(container.locator("text=address this whole block")).toBeVisible();

    // The persisted comment spans more than one line.
    const res = await page.request.get(
      `${baseURL}/api/diff/reviews?session=${encodeURIComponent(name)}`,
    );
    const { comments } = await res.json();
    expect(comments).toHaveLength(1);
    expect(comments[0].endLine).toBeGreaterThan(comments[0].startLine);
  });
});
