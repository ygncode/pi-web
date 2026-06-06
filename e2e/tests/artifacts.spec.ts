import { test, expect } from "../lib/test";
import { buildSession, uniqueSessionName, writeSession } from "../lib/sessions";

/**
 * Build a session whose assistant turn produces two artifacts:
 *   - a fenced ```html block  → preview-kind artifact
 *   - a `write` of src/widget.go → code-kind artifact
 */
function sessionWithArtifacts() {
  const { entries, lastId } = buildSession();
  const id = `e2e-artifact-${Date.now()}`;
  entries.push({
    type: "message",
    id,
    parentId: lastId,
    timestamp: new Date().toISOString(),
    message: {
      role: "assistant",
      content: [
        {
          type: "text",
          text: 'Rendered the hero markup:\n\n```html\n<section class="hero">\n  <h1>Hello</h1>\n  <p>World</p>\n</section>\n```',
        },
        {
          type: "toolCall",
          id: `wc-${Date.now()}`,
          name: "write",
          arguments: {
            file_path: "src/widget.go",
            content: 'package widget\n\nfunc New() string {\n\treturn "hi"\n}\n',
          },
        },
      ],
      timestamp: Date.now(),
    },
  });
  return entries;
}

function sessionWithMarkdown() {
  const { entries, lastId } = buildSession();
  const id = `e2e-md-${Date.now()}`;
  entries.push({
    type: "message",
    id,
    parentId: lastId,
    timestamp: new Date().toISOString(),
    message: {
      role: "assistant",
      content: [
        {
          type: "toolCall",
          id: `mc-${Date.now()}`,
          name: "write",
          arguments: { file_path: "notes.md", content: "# Heading\n\nSome **bold** text.\n" },
        },
      ],
      timestamp: Date.now(),
    },
  });
  return entries;
}

function sessionWithRename() {
  const { entries, lastId } = buildSession();
  const writeId = `e2e-w-${Date.now()}`;
  const bashId = `bc-${Date.now()}`;
  entries.push({
    type: "message",
    id: writeId,
    parentId: lastId,
    timestamp: new Date().toISOString(),
    message: {
      role: "assistant",
      content: [
        { type: "toolCall", id: `wc-${Date.now()}`, name: "write", arguments: { file_path: "daytrip.md", content: "# Trip\n" } },
        { type: "toolCall", id: bashId, name: "bash", arguments: { command: "mv daytrip.md day-trip.md" } },
      ],
      timestamp: Date.now(),
    },
  });
  entries.push({
    type: "message",
    id: `tr-${Date.now()}`,
    parentId: writeId,
    timestamp: new Date().toISOString(),
    message: { role: "toolResult", toolCallId: bashId, isError: false, content: [{ type: "text", text: "ok" }] },
  });
  return entries;
}

/**
 * One assistant turn producing a mix of artifacts so include filters have
 * something to keep and something to drop:
 *   - write notes.md       (matches *.md)
 *   - write page.html      (matches *.html)
 *   - write src/widget.go  (matches neither)
 *   - a fenced ```html block → snippet (no path; dropped by any non-empty filter)
 */
function sessionWithMixedArtifacts() {
  const { entries, lastId } = buildSession();
  const id = `e2e-mixed-${Date.now()}`;
  entries.push({
    type: "message",
    id,
    parentId: lastId,
    timestamp: new Date().toISOString(),
    message: {
      role: "assistant",
      content: [
        { type: "text", text: "Snippet:\n\n```html\n<b>hi</b>\n```" },
        { type: "toolCall", id: `mc1-${Date.now()}`, name: "write", arguments: { file_path: "notes.md", content: "# Notes\n" } },
        { type: "toolCall", id: `mc2-${Date.now()}`, name: "write", arguments: { file_path: "page.html", content: "<h1>Page</h1>\n" } },
        { type: "toolCall", id: `mc3-${Date.now()}`, name: "write", arguments: { file_path: "src/widget.go", content: "package widget\n" } },
      ],
      timestamp: Date.now(),
    },
  });
  return entries;
}

/** Seed an artifact setting in localStorage before the page's scripts run. */
async function seedArtifactSetting(
  page: import("@playwright/test").Page,
  key: string,
  value: string,
) {
  await page.addInitScript(
    ([k, v]) => {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* ignore */
      }
    },
    [key, value] as const,
  );
}

async function openArtifactsTab(page: import("@playwright/test").Page) {
  // Wait until the session app has initialized (a populated tree) so the sidebar
  // collapse state has settled — reading it too early made the tab click race
  // the slide-in animation and miss ("element outside viewport"). `attached`
  // because the tree sidebar is hidden on mobile.
  await page
    .locator("#tree-container .tree-node")
    .first()
    .waitFor({ state: "attached" });
  // The right sidebar is open by default on desktop but collapsed on mobile;
  // toggle it open only when collapsed so we don't accidentally close it.
  const collapsed = await page.evaluate(() =>
    document.body.classList.contains("right-sidebar-collapsed"),
  );
  if (collapsed) {
    await page.locator("#toggle-right-sidebar-btn").click();
    await expect(page.locator("body")).not.toHaveClass(/right-sidebar-collapsed/);
  }
  // click() auto-waits for actionability and scrolls the tab into view (the tab
  // row can overflow horizontally on narrow mobile viewports).
  await page.locator("#right-tab-artifacts").click();
  await expect(page.locator("#right-pane-artifacts")).toBeVisible();
}

test.describe("artifacts panel", () => {
  test("lists write + fenced-block artifacts with a count badge", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const name = uniqueSessionName(testInfo, "art");
    const id = writeSession(sessionsDir, name, sessionWithArtifacts());

    await page.goto(`/session?id=${encodeURIComponent(id)}`);
    await openArtifactsTab(page);

    await expect(page.locator("#artifact-tab-count")).toHaveText("2");
    await expect(page.locator(".artifact-list-item")).toHaveCount(2);
    await expect(
      page.locator(".artifact-list-item", { hasText: "widget.go" }),
    ).toBeVisible();
    // Exactly one previewable artifact (the html block) carries the badge.
    await expect(page.locator(".artifact-list-item .artifact-badge")).toHaveCount(1);
  });

  test("selecting an artifact shows its source", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const name = uniqueSessionName(testInfo, "art");
    const id = writeSession(sessionsDir, name, sessionWithArtifacts());

    await page.goto(`/session?id=${encodeURIComponent(id)}`);
    await openArtifactsTab(page);

    await page.locator(".artifact-list-item", { hasText: "widget.go" }).click();
    await expect(page.locator(".artifact-view-title")).toHaveText("widget.go");
    await expect(page.locator(".artifact-source")).toContainText("package widget");

    await page.locator(".artifact-list-item .artifact-badge").click();
    await expect(page.locator(".artifact-source")).toContainText('class="hero"');
  });

  test("runs a preview-kind artifact in a sandboxed iframe", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const name = uniqueSessionName(testInfo, "art");
    const id = writeSession(sessionsDir, name, sessionWithArtifacts());

    await page.goto(`/session?id=${encodeURIComponent(id)}`);
    await openArtifactsTab(page);

    // The previewable artifact is the html block (it carries the badge).
    await page.locator(".artifact-list-item .artifact-badge").click();
    const runBtn = page.locator('.artifact-action[data-action="toggle-preview"]');
    await expect(runBtn).toHaveText("Run preview");
    // Click-to-run: nothing executes until the user opts in.
    await expect(page.locator("iframe.artifact-preview")).toHaveCount(0);

    await runBtn.click();

    const frame = page.locator("iframe.artifact-preview");
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute("sandbox", "allow-scripts");
    // The iframe actually renders the markup (opaque-origin srcdoc document).
    await expect(
      page.frameLocator("iframe.artifact-preview").locator("h1"),
    ).toHaveText("Hello");
    await expect(runBtn).toHaveText("Show source");

    // Toggling back removes the frame and restores the source view.
    await runBtn.click();
    await expect(page.locator("iframe.artifact-preview")).toHaveCount(0);
    await expect(page.locator(".artifact-source")).toContainText('class="hero"');
  });

  test("previews a markdown artifact inline (not an iframe)", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const name = uniqueSessionName(testInfo, "art");
    const id = writeSession(sessionsDir, name, sessionWithMarkdown());

    await page.goto(`/session?id=${encodeURIComponent(id)}`);
    await openArtifactsTab(page);

    await page.locator(".artifact-list-item", { hasText: "notes.md" }).click();
    const previewBtn = page.locator('.artifact-action[data-action="toggle-preview"]');
    await expect(previewBtn).toHaveText("Preview");

    await previewBtn.click();

    // Rendered markdown, no iframe.
    await expect(page.locator(".artifact-markdown h1")).toHaveText("Heading");
    await expect(page.locator(".artifact-markdown strong")).toHaveText("bold");
    await expect(page.locator("iframe.artifact-preview")).toHaveCount(0);
  });

  test("follows a rename via bash mv (one card, new name)", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const name = uniqueSessionName(testInfo, "art");
    const id = writeSession(sessionsDir, name, sessionWithRename());

    await page.goto(`/session?id=${encodeURIComponent(id)}`);
    await openArtifactsTab(page);

    await expect(page.locator(".artifact-list-item")).toHaveCount(1);
    await expect(page.locator(".artifact-list-item", { hasText: "day-trip.md" })).toBeVisible();
  });

  test("explains artifacts and limitations via the help (?) button", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const name = uniqueSessionName(testInfo, "art");
    const id = writeSession(sessionsDir, name, sessionWithArtifacts());

    await page.goto(`/session?id=${encodeURIComponent(id)}`);
    await openArtifactsTab(page);

    const helpBtn = page.locator("#artifact-help-btn");
    await expect(helpBtn).toBeVisible();
    await helpBtn.click();

    const modal = page.locator("#artifact-help-modal");
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("How artifacts work");
    await expect(modal).toContainText("other shell commands");

    await page.locator(".artifact-help-close").click();
    await expect(modal).toBeHidden();
  });

  test("downloads the selected artifact with its filename", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const name = uniqueSessionName(testInfo, "art");
    const id = writeSession(sessionsDir, name, sessionWithArtifacts());

    await page.goto(`/session?id=${encodeURIComponent(id)}`);
    await openArtifactsTab(page);

    await page.locator(".artifact-list-item", { hasText: "widget.go" }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator('.artifact-action[data-action="download"]').click(),
    ]);
    expect(download.suggestedFilename()).toBe("widget.go");
  });

  test("include filter keeps matching files and drops others + snippets", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const name = uniqueSessionName(testInfo, "art");
    const id = writeSession(sessionsDir, name, sessionWithMixedArtifacts());

    await seedArtifactSetting(page, "pi-web:v1:artifacts:include", "*.md, *.html");
    await page.goto(`/session?id=${encodeURIComponent(id)}`);
    await openArtifactsTab(page);

    // notes.md + page.html survive; src/widget.go and the html snippet are hidden.
    await expect(page.locator("#artifact-tab-count")).toHaveText("2");
    await expect(page.locator(".artifact-list-item")).toHaveCount(2);
    await expect(page.locator(".artifact-list-item", { hasText: "notes.md" })).toBeVisible();
    await expect(page.locator(".artifact-list-item", { hasText: "page.html" })).toBeVisible();
    await expect(page.locator(".artifact-list-item", { hasText: "widget.go" })).toHaveCount(0);
  });

  test("empty-state hint links to Settings when the filter hides everything", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const name = uniqueSessionName(testInfo, "art");
    const id = writeSession(sessionsDir, name, sessionWithMixedArtifacts());

    // A filter that matches none of the four artifacts.
    await seedArtifactSetting(page, "pi-web:v1:artifacts:include", "*.rs");
    await page.goto(`/session?id=${encodeURIComponent(id)}`);
    await openArtifactsTab(page);

    await expect(page.locator(".artifact-list-item")).toHaveCount(0);
    const empty = page.locator(".artifact-empty");
    await expect(empty).toContainText("hidden by your filter");
    await expect(empty.locator('a[href="/settings"]')).toBeVisible();
  });

  test("disabling artifacts hides the tab and falls back to Scratchpad", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const name = uniqueSessionName(testInfo, "art");
    const id = writeSession(sessionsDir, name, sessionWithArtifacts());

    await seedArtifactSetting(page, "pi-web:v1:artifacts:enabled", "false");
    await page.goto(`/session?id=${encodeURIComponent(id)}`);

    // Open the sidebar so its tabs are laid out (collapsed on mobile).
    const collapsed = await page.evaluate(() =>
      document.body.classList.contains("right-sidebar-collapsed"),
    );
    if (collapsed) await page.locator("#toggle-right-sidebar-btn").click();

    // The Artifacts tab is actually not rendered (visibility, not just the
    // `hidden` property) while its siblings remain visible — guards against the
    // CSS `display` rule overriding the `[hidden]` attribute.
    await expect(page.locator("#right-tab-scratchpad")).toBeVisible();
    await expect(page.locator("#right-tab-notes")).toBeVisible();
    await expect(page.locator("#right-tab-artifacts")).toBeHidden();
    // Scratchpad remains the active tab.
    await expect(page.locator("#right-tab-scratchpad")).toHaveClass(/active/);
  });

  test("reflects a setting change from another tab live (no reload)", async ({
    page,
    context,
    sessionsDir,
  }, testInfo) => {
    const name = uniqueSessionName(testInfo, "art");
    const id = writeSession(sessionsDir, name, sessionWithArtifacts());

    await page.goto(`/session?id=${encodeURIComponent(id)}`);
    const collapsed = await page.evaluate(() =>
      document.body.classList.contains("right-sidebar-collapsed"),
    );
    if (collapsed) await page.locator("#toggle-right-sidebar-btn").click();
    await expect(page.locator("#right-tab-artifacts")).toBeVisible();

    // A second tab in the same context flips the setting; the shared-localStorage
    // write fires a `storage` event in the open session, which re-runs the filter.
    const other = await context.newPage();
    await other.goto("/");
    await other.evaluate(() =>
      localStorage.setItem("pi-web:v1:artifacts:enabled", "false"),
    );

    await expect(page.locator("#right-tab-artifacts")).toBeHidden();
    await other.close();
  });
});
