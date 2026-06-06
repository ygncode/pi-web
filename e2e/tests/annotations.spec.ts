import { test, expect } from "../lib/test";
import {
  buildSession,
  realWorkingDir,
  uniqueSessionName,
  writeSession,
} from "../lib/sessions";

// The SPA renders the session view asynchronously. Wait until runSessionApp has
// run — a populated tree means #messages is fully rendered and the sidebar
// collapse state has settled — before reading body classes or walking the DOM.
// Use `attached` (not `visible`): on mobile the tree sidebar is hidden.
async function waitSessionReady(page: import("@playwright/test").Page) {
  await page
    .locator("#tree-container .tree-node")
    .first()
    .waitFor({ state: "attached" });
}

async function openRightSidebar(page: import("@playwright/test").Page) {
  await waitSessionReady(page);
  const collapsed = await page.evaluate(() =>
    document.body.classList.contains("right-sidebar-collapsed"),
  );
  if (collapsed) {
    await page.locator("#toggle-right-sidebar-btn").click();
    await expect(page.locator("body")).not.toHaveClass(/right-sidebar-collapsed/);
  }
}

async function collapseRightSidebar(page: import("@playwright/test").Page) {
  await waitSessionReady(page);
  const collapsed = await page.evaluate(() =>
    document.body.classList.contains("right-sidebar-collapsed"),
  );
  if (!collapsed) {
    await page.locator("#toggle-right-sidebar-btn").click();
  }
  await expect(page.locator("body")).toHaveClass(/right-sidebar-collapsed/);
}

/**
 * Select a word inside the first assistant message and fire mouseup so the
 * annotation popover appears, then save a note. Selection is built in-page for
 * cross-browser determinism (no flaky mouse-drag coordinates).
 */
async function annotateFirstMessage(
  page: import("@playwright/test").Page,
  note: string,
) {
  // The annotation source lives in #messages, which the SPA fills in
  // asynchronously; wait for it to hold real text before walking it.
  await waitSessionReady(page);
  await page.waitForFunction(() => {
    const m = document.getElementById("messages");
    return !!m && /[A-Za-z]{4,}/.test(m.textContent || "");
  });
  const selected = await page.evaluate(() => {
    const messages = document.getElementById("messages")!;
    const walker = document.createTreeWalker(messages, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const m = node.nodeValue && node.nodeValue.match(/[A-Za-z]{4,}/);
      if (m) {
        const startOff = node.nodeValue!.indexOf(m[0]);
        const range = document.createRange();
        range.setStart(node, startOff);
        range.setEnd(node, startOff + m[0].length);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);
        document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        return m[0];
      }
    }
    return "";
  });

  await page.locator('.annotation-popover [data-action="start-comment"]').click();
  await page.locator(".annotation-note-input").fill(note);
  await page.locator('[data-action="save-note"]').click();
  return selected;
}

test.describe("annotations", () => {
  test("annotate a message, highlight it, and send the note to pi", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const { entries } = buildSession({ cwd: realWorkingDir() });
    const name = uniqueSessionName(testInfo, "ann");
    const id = writeSession(sessionsDir, name, entries);

    await page.goto(`/session?id=${encodeURIComponent(id)}`);

    // Annotate while the sidebar is closed: the popover lives over #messages and
    // needs no sidebar, and on mobile an open sidebar's backdrop would block it.
    const word = await annotateFirstMessage(page, "rename this");

    // Inline highlight on the chosen word.
    const mark = page.locator("#messages mark.pi-annotation");
    await expect(mark).toHaveText(word);

    // Notes tab badge + entry.
    await openRightSidebar(page);
    await expect(page.locator("#annotation-tab-count")).toHaveText("1");
    await page.locator("#right-tab-notes").click();
    await expect(page.locator(".annotation-item .annotation-note")).toHaveText("rename this");

    // Send to pi fills (not submits) the composer.
    await page.locator('[data-action="send-to-pi"]').click();
    await expect(page.locator("#pi-chat-message")).toHaveValue(/rename this/);
  });

  test("annotate text inside an artifact's source", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const { entries, lastId } = buildSession({ cwd: realWorkingDir() });
    const writeId = `e2e-art-${Date.now()}`;
    entries.push({
      type: "message",
      id: writeId,
      parentId: lastId,
      timestamp: new Date().toISOString(),
      message: {
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: `wc-${Date.now()}`,
            name: "write",
            arguments: { file_path: "widget.go", content: 'package widget\n\nfunc New() {}\n' },
          },
        ],
        timestamp: Date.now(),
      },
    });
    const name = uniqueSessionName(testInfo, "ann");
    const id = writeSession(sessionsDir, name, entries);

    await page.goto(`/session?id=${encodeURIComponent(id)}`);
    await openRightSidebar(page);
    await page.locator("#right-tab-artifacts").click();
    await page.locator(".artifact-list-item", { hasText: "widget.go" }).click();

    // Select a word inside the artifact source and open the popover.
    const word = await page.evaluate(() => {
      const pre = document.querySelector("pre.artifact-source")!;
      const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const m = node.nodeValue && node.nodeValue.match(/[A-Za-z]{4,}/);
        if (m) {
          const off = node.nodeValue!.indexOf(m[0]);
          const range = document.createRange();
          range.setStart(node, off);
          range.setEnd(node, off + m[0].length);
          const sel = window.getSelection()!;
          sel.removeAllRanges();
          sel.addRange(range);
          document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
          return m[0];
        }
      }
      return "";
    });

    await page.locator('.annotation-popover [data-action="start-comment"]').click();
    await page.locator(".annotation-note-input").fill("refactor this");
    await page.locator('[data-action="save-note"]').click();

    // Highlight lands inside the artifact source, and the note shows in Notes.
    await expect(page.locator("pre.artifact-source mark.pi-annotation")).toHaveText(word);
    await page.locator("#right-tab-notes").click();
    await expect(page.locator(".annotation-item .annotation-note")).toHaveText("refactor this");

    // Sending to pi references the file path + line number, not just the quote.
    await page.locator('[data-action="send-to-pi"]').click();
    await expect(page.locator("#pi-chat-message")).toHaveValue(/In widget\.go:/);
    await expect(page.locator("#pi-chat-message")).toHaveValue(/Line \d+ —/);
  });

  test("delete a note", async ({ page, sessionsDir }, testInfo) => {
    const { entries } = buildSession({ cwd: realWorkingDir() });
    const name = uniqueSessionName(testInfo, "ann");
    const id = writeSession(sessionsDir, name, entries);

    await page.goto(`/session?id=${encodeURIComponent(id)}`);
    await annotateFirstMessage(page, "remove me");
    // Wait for the highlight (confirms the annotation persisted) before opening
    // the Notes tab, so we don't race the create round-trip.
    await expect(page.locator("#messages mark.pi-annotation")).toHaveCount(1);

    await openRightSidebar(page);
    await page.locator("#right-tab-notes").click();
    await expect(page.locator(".annotation-item")).toHaveCount(1);

    await page.locator('.annotation-item [data-action="delete"]').click();
    await expect(page.locator(".annotation-item")).toHaveCount(0);
    await expect(page.locator("#messages mark.pi-annotation")).toHaveCount(0);
  });

  test("saving a note reveals the sidebar on the Annotations tab", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const { entries } = buildSession({ cwd: realWorkingDir() });
    const name = uniqueSessionName(testInfo, "ann");
    const id = writeSession(sessionsDir, name, entries);

    await page.goto(`/session?id=${encodeURIComponent(id)}`);

    // Start with the sidebar hidden, then annotate without touching it manually.
    await collapseRightSidebar(page);
    await annotateFirstMessage(page, "open me");

    // onCreate should have opened the sidebar and switched to the Notes tab —
    // no openRightSidebar() / tab click here on purpose.
    await expect(page.locator("body")).not.toHaveClass(/right-sidebar-collapsed/);
    await expect(page.locator("#right-tab-notes")).toHaveClass(/active/);
    await expect(page.locator("#right-pane-notes")).toBeVisible();
    await expect(page.locator(".annotation-item .annotation-note")).toHaveText("open me");
  });

  test("sending notes to pi collapses the sidebar and focuses the composer on mobile", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const { entries } = buildSession({ cwd: realWorkingDir() });
    const name = uniqueSessionName(testInfo, "ann");
    const id = writeSession(sessionsDir, name, entries);

    await page.goto(`/session?id=${encodeURIComponent(id)}`);

    // Create a note; onCreate opens the sidebar on the Notes tab, where the
    // "Send … to pi" button lives.
    await annotateFirstMessage(page, "ship it");
    const sendBtn = page.locator('[data-action="send-to-pi"]');
    await expect(sendBtn).toBeVisible();

    const mobile = await page.evaluate(() =>
      window.matchMedia("(max-width: 900px)").matches,
    );

    await sendBtn.click();

    // The composer is filled regardless of layout.
    await expect(page.locator("#pi-chat-message")).toHaveValue(/ship it/);

    if (mobile) {
      // The overlay sidebar gets out of the way and the composer takes focus.
      await expect(page.locator("body")).toHaveClass(/right-sidebar-collapsed/);
      await expect(page.locator("#pi-chat-message")).toBeFocused();
    } else {
      // Desktop keeps the sidebar in place beside the content.
      await expect(page.locator("body")).not.toHaveClass(/right-sidebar-collapsed/);
    }
  });
});
