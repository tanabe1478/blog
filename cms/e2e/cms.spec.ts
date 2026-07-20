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
  onCreate?: (payload: unknown) => void;
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

  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(textarea).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Existing title", exact: true }),
  ).toBeVisible();
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
