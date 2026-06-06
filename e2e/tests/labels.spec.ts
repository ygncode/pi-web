import { expect, test, isMobileLayout } from "../lib/test";
import { buildSession, uniqueSessionName, writeSession } from "../lib/sessions";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test.describe("session labels", () => {
  test("adds a label from the message action bar and shows it in the tree", async ({
    page,
    sessionsDir,
  }, testInfo) => {
    const name = uniqueSessionName(testInfo, "labels");
    const { entries, lastId } = buildSession();
    const id = writeSession(sessionsDir, name, entries);

    await page.goto(`/session?id=${encodeURIComponent(id)}`);
    await expect(page.locator(`#entry-${lastId}`)).toBeVisible();

    await page.locator(`#entry-${lastId} .label-btn`).click({ force: true });
    await page.locator('#label-modal-input').fill('Review checkpoint');
    await page.locator('.label-modal-save').click();

    await expect(page.locator("#tree-container .tree-label", { hasText: "[Review checkpoint]" })).toBeVisible();

    // On mobile the tree is an off-screen drawer; open it so its filter controls
    // are in the viewport and clickable.
    if (await isMobileLayout(page)) {
      await page.locator("#tree-toggle").dispatchEvent("click");
      await expect(page.locator("#sidebar")).toHaveClass(/open/);
    }

    await page.locator('.filter-btn[data-filter="labeled-only"]').click();
    await expect(page.locator("#tree-container .tree-node")).toHaveCount(1);
    await expect(page.locator("#tree-container .tree-node")).toContainText("Review checkpoint");

    const file = readFileSync(join(sessionsDir, "--home-user-demo-project--", name), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const labelEntry = file.find((entry) => entry.type === "label" && entry.targetId === lastId);
    expect(labelEntry).toMatchObject({ type: "label", targetId: lastId, label: "Review checkpoint" });
  });

  test("removes an existing label from the label modal", async ({ page, sessionsDir }, testInfo) => {
    const name = uniqueSessionName(testInfo, "labels-remove");
    const { entries, lastId } = buildSession();
    entries.push({
      type: "label",
      id: "label-existing",
      parentId: lastId,
      timestamp: new Date().toISOString(),
      targetId: lastId,
      label: "Old label",
    });
    const id = writeSession(sessionsDir, name, entries);

    await page.goto(`/session?id=${encodeURIComponent(id)}`);
    await expect(page.locator("#tree-container .tree-label", { hasText: "[Old label]" })).toBeVisible();
    await page.locator(`#entry-${lastId} .label-btn`).click({ force: true });
    await expect(page.locator('.label-modal-remove')).toBeVisible();
    await page.locator('.label-modal-remove').click();

    await expect(page.locator("#tree-container .tree-label", { hasText: "[Old label]" })).toHaveCount(0);
    const file = readFileSync(join(sessionsDir, "--home-user-demo-project--", name), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const clearEntry = file.at(-1);
    expect(clearEntry).toMatchObject({ type: "label", targetId: lastId });
    expect(clearEntry.label).toBeUndefined();
  });
});
