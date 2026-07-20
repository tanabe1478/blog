import { expect, test, type Page } from "@playwright/test";

const EXISTING_NAME = "existing-post.md";
const EXISTING_CONTENT = `---
date: 2026-07-20 10:00
description: "Existing description"
tags: 技術
---

# Existing title

Existing paragraph.
`;

interface MockOptions {
  createConflict?: boolean;
  createError?: boolean;
  updateConflict?: boolean;
  onCreate?: (payload: unknown) => void;
  onUpdate?: (payload: unknown) => void;
}

async function mockCmsApi(page: Page, options: MockOptions = {}) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "GET" && url.pathname === "/api/posts") {
      await route.fulfill({
        json: {
          posts: [
            {
              name: EXISTING_NAME,
              title: "Existing title",
              date: "2026-07-20 10:00",
              path: `Content/posts/${EXISTING_NAME}`,
              githubUrl:
                "https://github.com/tanabe1478/blog/blob/main/Content/posts/existing-post.md",
              publicUrl:
                "https://tanabe1478.github.io/posts/existing-post/",
            },
          ],
        },
      });
      return;
    }

    if (
      request.method() === "GET" &&
      url.pathname === `/api/posts/${EXISTING_NAME}`
    ) {
      await route.fulfill({
        json: {
          post: {
            name: EXISTING_NAME,
            path: `Content/posts/${EXISTING_NAME}`,
            content: EXISTING_CONTENT,
            sha: "a".repeat(40),
            githubUrl:
              "https://github.com/tanabe1478/blog/blob/main/Content/posts/existing-post.md",
            publicUrl:
              "https://tanabe1478.github.io/posts/existing-post/",
          },
        },
      });
      return;
    }

    if (
      request.method() === "PUT" &&
      url.pathname === `/api/posts/${EXISTING_NAME}`
    ) {
      const payload: unknown = request.postDataJSON();
      options.onUpdate?.(payload);
      if (options.updateConflict) {
        await route.fulfill({
          status: 409,
          json: { error: "記事が他の場所で更新されています。再読み込みしてください" },
        });
        return;
      }
      await route.fulfill({
        json: {
          update: {
            sha: "b".repeat(40),
            commitSha: "c".repeat(40),
            githubUrl:
              "https://github.com/tanabe1478/blog/blob/main/Content/posts/existing-post.md",
          },
        },
      });
      return;
    }

    if (request.method() === "POST" && url.pathname === "/api/posts") {
      const payload: unknown = request.postDataJSON();
      options.onCreate?.(payload);
      if (options.createError) {
        await route.fulfill({
          status: 502,
          json: { error: "記事を作成できませんでした" },
        });
        return;
      }
      if (options.createConflict) {
        await route.fulfill({
          status: 409,
          json: { error: "同じslugの記事が既に存在します" },
        });
        return;
      }
      await route.fulfill({
        status: 201,
        json: {
          post: {
            name: "new-post.md",
            sha: "b".repeat(40),
            commitSha: "c".repeat(40),
            githubUrl:
              "https://github.com/tanabe1478/blog/blob/main/Content/posts/new-post.md",
            publicUrl: "https://tanabe1478.github.io/posts/new-post/",
          },
        },
      });
      return;
    }

    await route.fulfill({ status: 404, json: { error: "E2E mock not found" } });
  });
}

async function openNewPostEditor(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "新規記事" }).click();
  await page.locator("#new-slug").fill("new-post");
  await page.locator("#new-title").fill("New title");
  await page.locator("#new-date").fill("2026-07-21T09:30");
  await page.locator("#new-description").fill("Created from E2E");
  await page.locator("#new-tags").fill("技術, 日記");
  await page.getByRole("button", { name: "本文を編集" }).click();
}

test("opens an article, edits it in two panes, and cancels", async ({ page }) => {
  await mockCmsApi(page);
  await page.goto("/");

  await expect(page.getByText("1件の記事")).toBeVisible();
  await page.getByRole("link", { name: /Existing title/ }).click();

  const textarea = page.getByLabel("Markdown本文");
  await expect(textarea).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Existing title", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "公開ページを開く" })).toHaveAttribute(
    "href",
    "https://tanabe1478.github.io/posts/existing-post/",
  );
  await expect(
    page.getByRole("link", { name: "GitHubで元ファイルを開く" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/tanabe1478/blog/blob/main/Content/posts/existing-post.md",
  );

  await page.getByRole("button", { name: "編集", exact: true }).click();
  await expect(textarea).toBeVisible();
  await textarea.fill("# Changed title\n\nChanged body.");
  await expect(
    page.getByRole("heading", { name: "Changed title", exact: true }),
  ).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(textarea).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Existing title", exact: true }),
  ).toBeVisible();
});

test("recovers an existing article draft after reload and can discard it", async ({
  page,
}) => {
  await mockCmsApi(page);
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();

  const textarea = page.getByLabel("Markdown本文");
  const draftContent = "# Existing draft\n\nReloadしても残る本文。";
  await textarea.fill(draftContent);
  await expect(page.locator("#draft-state")).toContainText(
    "下書きをこの端末に保存しました",
  );

  await page.reload();
  await expect(page.locator("#draft-notice")).toBeVisible();
  await expect(page.getByRole("button", { name: "編集", exact: true })).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "Existing title", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "下書きを復元" }).click();
  await expect(textarea).toHaveValue(draftContent);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(textarea).toBeHidden();
  await expect(page.locator("#draft-notice")).toBeHidden();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.includes(":draft:v1:")),
    ),
  ).toEqual([]);
});

test("uses the draft base SHA when GitHub changed after drafting", async ({
  page,
}) => {
  let updatePayload: unknown;
  await page.addInitScript(
    ({ name, sha }) => {
      const key = `blog-cms:draft:v1:${location.host}:${name}`;
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          name,
          content: "# Stale draft\n\n競合対象の本文。",
          baseSha: sha,
          isNew: false,
          savedAt: "2026-07-20T10:30:00.000Z",
        }),
      );
    },
    { name: EXISTING_NAME, sha: "d".repeat(40) },
  );
  await mockCmsApi(page, {
    updateConflict: true,
    onUpdate: (payload) => {
      updatePayload = payload;
    },
  });
  await page.goto(`/?post=${EXISTING_NAME}`);

  await expect(page.locator("#draft-notice")).toContainText(
    "GitHub版が更新されているため",
  );
  await page.getByRole("button", { name: "下書きを復元" }).click();
  await page.getByRole("button", { name: "GitHubへ保存" }).click();

  expect(updatePayload).toMatchObject({ sha: "d".repeat(40) });
  await expect(page.getByText(/記事が他の場所で更新されています/)).toBeVisible();
  await expect(page.getByLabel("Markdown本文")).toHaveValue(/競合対象の本文。/);
});

test("recovers a new article after reload and clears its draft after save", async ({
  page,
}) => {
  await mockCmsApi(page);
  await openNewPostEditor(page);

  const textarea = page.getByLabel("Markdown本文");
  await textarea.fill(`${await textarea.inputValue()}Reload対象の本文。\n`);
  await expect(page.locator("#draft-state")).toContainText(
    "下書きをこの端末に保存しました",
  );
  await expect(page).toHaveURL(/\?draft=new-post\.md$/);

  await page.reload();
  await expect(page.locator("#draft-notice")).toBeVisible();
  await page.getByRole("button", { name: "下書きを復元" }).click();
  await expect(textarea).toHaveValue(/Reload対象の本文。/);
  await page.getByRole("button", { name: "GitHubへ保存" }).click();

  await expect(textarea).toBeHidden();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.includes(":draft:v1:")),
    ),
  ).toEqual([]);
});

test("keeps editing when browser storage is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("storage unavailable", "QuotaExceededError");
    };
  });
  await mockCmsApi(page);
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();

  const textarea = page.getByLabel("Markdown本文");
  await textarea.fill("# Storage failure\n\n本文は編集できる。");
  await expect(page.locator("#draft-state")).toContainText(
    "端末下書きを保存できません",
  );
  await expect(textarea).toHaveValue(/本文は編集できる。/);
});

test("creates an unsaved article and saves it for the first time", async ({
  page,
}) => {
  let createPayload: unknown;
  await mockCmsApi(page, {
    onCreate: (payload) => {
      createPayload = payload;
    },
  });
  await openNewPostEditor(page);

  const textarea = page.getByLabel("Markdown本文");
  await expect(textarea).toHaveValue(
    /date: 2026-07-21 09:30[\s\S]*description: "Created from E2E"[\s\S]*tags: 技術, 日記[\s\S]*# New title/,
  );
  await expect(
    page.getByRole("heading", { name: "New title", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "公開ページを開く" })).toBeHidden();

  await textarea.fill(`${await textarea.inputValue()}本文です。\n`);
  await page.getByRole("button", { name: "GitHubへ保存" }).click();

  expect(createPayload).toMatchObject({
    name: "new-post.md",
    content: expect.stringContaining("本文です。"),
  });
  await expect(textarea).toBeHidden();
  await expect(page.getByText("公開処理はGitHub Actionsで進みます。", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "公開ページを開く" })).toHaveAttribute(
    "href",
    "https://tanabe1478.github.io/posts/new-post/",
  );
  await expect(page).toHaveURL(/\?post=new-post\.md$/);
});

test("keeps an unsaved new article when creation conflicts", async ({ page }) => {
  await mockCmsApi(page, { createConflict: true });
  await openNewPostEditor(page);

  const textarea = page.getByLabel("Markdown本文");
  const content = `${await textarea.inputValue()}競合しても残る本文。\n`;
  await textarea.fill(content);
  await page.getByRole("button", { name: "GitHubへ保存" }).click();

  await expect(page.getByText("同じslugの記事が既に存在します")).toBeVisible();
  await expect(textarea).toBeVisible();
  await expect(textarea).toHaveValue(content);
});

test("keeps an unsaved new article when creation fails", async ({ page }) => {
  await mockCmsApi(page, { createError: true });
  await openNewPostEditor(page);

  const textarea = page.getByLabel("Markdown本文");
  const content = `${await textarea.inputValue()}失敗しても残る本文。\n`;
  await textarea.fill(content);
  await page.getByRole("button", { name: "GitHubへ保存" }).click();

  await expect(page.getByText("記事を作成できませんでした")).toBeVisible();
  await expect(textarea).toBeVisible();
  await expect(textarea).toHaveValue(content);
});
