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
  deleteConflict?: boolean;
  renameConflict?: boolean;
  deploymentError?: boolean;
  deploymentStates?: Array<"pending" | "running" | "published" | "failed">;
  existingContent?: string;
  imageError?: boolean;
  onCreate?: (payload: unknown) => void;
  onUpdate?: (payload: unknown) => void;
  onDelete?: (payload: unknown) => void;
  onRename?: (payload: unknown) => void;
}

async function mockCmsApi(page: Page, options: MockOptions = {}) {
  let deploymentIndex = 0;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (
      request.method() === "GET" &&
      url.pathname.startsWith("/api/deployments/")
    ) {
      if (options.deploymentError) {
        await route.fulfill({
          status: 502,
          json: { error: "公開状況を取得できませんでした" },
        });
        return;
      }
      const states = options.deploymentStates ?? ["published"];
      const state = states[Math.min(deploymentIndex, states.length - 1)];
      deploymentIndex += 1;
      const commitSha = url.pathname.slice("/api/deployments/".length);
      await route.fulfill({
        json: {
          deployment: {
            commitSha,
            state,
            ...(state === "pending"
              ? {}
              : {
                  runUrl:
                    "https://github.com/tanabe1478/blog/actions/runs/789",
                  updatedAt: "2026-07-20T15:10:00Z",
                }),
          },
        },
      });
      return;
    }

    if (request.method() === "POST" && url.pathname === "/api/images") {
      if (options.imageError) {
        await route.fulfill({
          status: 502,
          json: { error: "画像をGyazoへアップロードできませんでした" },
        });
        return;
      }
      await route.fulfill({
        json: {
          image: {
            imageUrl: "https://i.gyazo.com/example.png",
            permalinkUrl: "https://gyazo.com/example",
            markdown:
              "[![screen](https://i.gyazo.com/example.png)](https://gyazo.com/example)",
          },
        },
      });
      return;
    }

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
            content: options.existingContent ?? EXISTING_CONTENT,
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
      request.method() === "GET" &&
      (url.pathname === "/api/posts/new-post.md" ||
        url.pathname === "/api/posts/renamed-post.md")
    ) {
      const name = url.pathname.endsWith("new-post.md")
        ? "new-post.md"
        : "renamed-post.md";
      await route.fulfill({
        json: {
          post: {
            name,
            path: `Content/posts/${name}`,
            content: name === "new-post.md" ? "# New title\n" : EXISTING_CONTENT,
            sha: "b".repeat(40),
            githubUrl: `https://github.com/tanabe1478/blog/blob/main/Content/posts/${name}`,
            publicUrl: `https://tanabe1478.github.io/posts/${name.slice(0, -3)}/`,
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

    if (
      request.method() === "PATCH" &&
      url.pathname === `/api/posts/${EXISTING_NAME}`
    ) {
      const payload: unknown = request.postDataJSON();
      options.onRename?.(payload);
      if (options.renameConflict) {
        await route.fulfill({
          status: 409,
          json: {
            error:
              "元記事が更新されたか、新slugが既に存在します。再読み込みしてください",
          },
        });
        return;
      }
      await route.fulfill({
        json: {
          rename: {
            name: "renamed-post.md",
            sha: "b".repeat(40),
            commitSha: "c".repeat(40),
            githubUrl:
              "https://github.com/tanabe1478/blog/blob/main/Content/posts/renamed-post.md",
            publicUrl: "https://tanabe1478.github.io/posts/renamed-post/",
          },
        },
      });
      return;
    }

    if (
      request.method() === "DELETE" &&
      url.pathname === `/api/posts/${EXISTING_NAME}`
    ) {
      const payload: unknown = request.postDataJSON();
      options.onDelete?.(payload);
      if (options.deleteConflict) {
        await route.fulfill({
          status: 409,
          json: { error: "記事が他の場所で更新されています。再読み込みしてください" },
        });
        return;
      }
      await route.fulfill({
        json: { deletion: { commitSha: "c".repeat(40) } },
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

async function openReactNewPostEditor(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "新規記事", exact: true }).click();
  await page.getByLabel("slug").fill("new-post");
  await page.getByLabel("タイトル").fill("New title");
  await page.getByLabel("公開日時").fill("2026-07-21T09:30");
  await page.getByLabel("説明").fill("Created from React E2E");
  await page.getByLabel("タグ（comma区切り）").fill("技術, 日記");
  await page.getByRole("button", { name: "記事を書き始める" }).click();
}

test("lists articles in the React CMS", async ({ page }) => {
  await mockCmsApi(page);
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Blog CMS", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("1件の記事")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Existing title/ }),
  ).toContainText("2026-07-20 10:00 · existing-post.md");
});

test("opens a rendered article detail in the React CMS", async ({ page }) => {
  await mockCmsApi(page, { existingContent: `\n${EXISTING_CONTENT}` });
  await page.goto("/");
  await page.getByRole("button", { name: /Existing title/ }).click();

  await expect(page).toHaveURL(/\/\?post=existing-post\.md$/);
  await expect(
    page.getByRole("heading", { name: "Existing title", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Existing paragraph.")).toBeVisible();
  await expect(page.getByRole("link", { name: "公開ページを開く" })).toHaveAttribute(
    "href",
    "https://tanabe1478.github.io/posts/existing-post/",
  );
  await page.getByRole("button", { name: "← 記事一覧へ" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:8787/");
});

test("does not execute raw HTML or unsafe URLs in React article detail", async ({
  page,
}) => {
  await mockCmsApi(page, {
    existingContent:
      '---\ndate: 2026-07-20 10:00\n---\n\n# Safe title\n\n<img src="x" onerror="alert(1)">\n\n[unsafe](javascript:alert(1))',
  });
  await page.goto(`/?post=${EXISTING_NAME}`);

  const article = page.locator(".markdown-article");
  await expect(page.getByRole("heading", { name: "Safe title" })).toBeVisible();
  await expect(article.locator("[onerror]")).toHaveCount(0);
  await expect(article.locator("script")).toHaveCount(0);
  await expect(article.locator('a[href^="javascript:"]')).toHaveCount(0);
});

test("edits and previews an article in React, then cancels", async ({ page }) => {
  await mockCmsApi(page);
  await page.goto(`/?post=${EXISTING_NAME}`);

  await page.getByRole("button", { name: "編集", exact: true }).click();
  const textarea = page.getByLabel("Markdown本文");
  await textarea.fill("# React changed\n\nPreview body.");
  await expect(
    page.getByRole("heading", { name: "React changed", exact: true }),
  ).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(textarea).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Existing title", exact: true }),
  ).toBeVisible();
});

test("saves a React article with its current SHA", async ({ page }) => {
  let updatePayload: unknown;
  await mockCmsApi(page, {
    onUpdate: (payload) => {
      updatePayload = payload;
    },
  });
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await page.getByLabel("Markdown本文").fill("# Saved in React\n");
  await page.getByRole("button", { name: "GitHubへ保存" }).click();

  expect(updatePayload).toEqual({
    content: "# Saved in React\n",
    sha: "a".repeat(40),
  });
  await expect(page.getByLabel("Markdown本文")).toBeHidden();
  await expect(page.getByText(/GitHubへ保存しました/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Saved in React", exact: true }),
  ).toBeVisible();
});

test("keeps React editor content when saving conflicts", async ({ page }) => {
  await mockCmsApi(page, { updateConflict: true });
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  const textarea = page.getByLabel("Markdown本文");
  await textarea.fill("# Conflict in React\n");
  await page.getByRole("button", { name: "GitHubへ保存" }).click();

  await expect(page.getByText(/記事が他の場所で更新されています/)).toBeVisible();
  await expect(textarea).toHaveValue("# Conflict in React\n");
  await expect(textarea).toBeVisible();
});

test("uploads a dropped image and inserts Gyazo Markdown in React", async ({
  page,
}) => {
  await mockCmsApi(page);
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  const textarea = page.getByLabel("Markdown本文");

  await textarea.evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array([1, 2, 3])], "screen.png", { type: "image/png" }));
    element.dispatchEvent(
      new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }),
    );
  });

  await expect(textarea).toHaveValue(/https:\/\/i\.gyazo\.com\/example\.png/);
  await expect(page.locator(".markdown-article img")).toHaveAttribute(
    "src",
    "https://i.gyazo.com/example.png",
  );
  await expect(page.getByText(/Gyazo画像を挿入しました/)).toBeVisible();
});

test("uploads a selected image from the React file picker", async ({ page }) => {
  await mockCmsApi(page);
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();

  await page.getByLabel("画像ファイル").setInputFiles({
    name: "picked.png",
    mimeType: "image/png",
    buffer: Buffer.from([1, 2, 3]),
  });

  await expect(page.getByLabel("Markdown本文")).toHaveValue(/gyazo\.com\/example/);
});

test("keeps React content when Gyazo upload fails", async ({ page }) => {
  await mockCmsApi(page, { imageError: true });
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  const textarea = page.getByLabel("Markdown本文");
  const before = await textarea.inputValue();

  await page.getByLabel("画像ファイル").setInputFiles({
    name: "failed.png",
    mimeType: "image/png",
    buffer: Buffer.from([1, 2, 3]),
  });

  await expect(page.getByText(/画像をGyazoへアップロードできませんでした/)).toBeVisible();
  await expect(textarea).toHaveValue(before);
});

test("recovers and discards an existing React draft", async ({ page }) => {
  await mockCmsApi(page);
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  const draftContent = "# React draft\n\nReload後も残る本文。";
  await page.getByLabel("Markdown本文").fill(draftContent);
  await expect(page.getByText(/下書きをこの端末に保存しました/)).toBeVisible();

  await page.reload();
  await expect(page.getByText(/この端末に未保存の下書きがあります/)).toBeVisible();
  await page.getByRole("button", { name: "下書きを復元" }).click();
  await expect(page.getByLabel("Markdown本文")).toHaveValue(draftContent);
  await expect(page.getByText("端末の下書きを復元しました。")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "下書きを破棄" }).click();
  await expect(page.getByText(/この端末に未保存の下書きがあります/)).toBeHidden();
  await expect(page.getByRole("button", { name: "編集", exact: true })).toBeEnabled();
  expect(
    await page.evaluate(() => Object.keys(localStorage).filter((key) => key.includes(":draft:v1:"))),
  ).toEqual([]);
});

test("uses the original SHA when saving a restored React draft", async ({ page }) => {
  let updatePayload: unknown;
  await mockCmsApi(page, {
    updateConflict: true,
    onUpdate: (payload) => {
      updatePayload = payload;
    },
  });
  await page.goto("/");
  const draftSha = "d".repeat(40);
  await page.evaluate(
    ({ name, sha }) => {
      localStorage.setItem(
        `blog-cms:draft:v1:${location.host}:${name}`,
        JSON.stringify({
          version: 1,
          name,
          content: "# Stale React draft\n",
          baseSha: sha,
          isNew: false,
          savedAt: new Date().toISOString(),
        }),
      );
    },
    { name: EXISTING_NAME, sha: draftSha },
  );
  await page.goto(`/?post=${EXISTING_NAME}`);
  await expect(page.getByText(/GitHub版が更新されている/)).toBeVisible();
  await page.getByRole("button", { name: "下書きを復元" }).click();
  await page.getByRole("button", { name: "GitHubへ保存" }).click();

  expect(updatePayload).toEqual({ content: "# Stale React draft\n", sha: draftSha });
  await expect(page.getByText(/記事が他の場所で更新されています/)).toBeVisible();
  await expect(page.getByLabel("Markdown本文")).toHaveValue("# Stale React draft\n");
});

test("recovers and saves a new React article draft", async ({ page }) => {
  let createPayload: unknown;
  await mockCmsApi(page, {
    onCreate: (payload) => {
      createPayload = payload;
    },
  });
  await openReactNewPostEditor(page);
  await expect(page).toHaveURL(/\?draft=new-post\.md$/);
  const textarea = page.getByLabel("Markdown本文");
  await textarea.fill(`${await textarea.inputValue()}React draft body.\n`);
  await expect(page.getByText(/下書きをこの端末に保存しました/)).toBeVisible();

  await page.reload();
  await expect(page.getByText(/この端末に未保存の下書きがあります/)).toBeVisible();
  await page.getByRole("button", { name: "下書きを復元" }).click();
  await expect(page.getByLabel("Markdown本文")).toHaveValue(/React draft body/);
  await page.getByRole("button", { name: "新規記事を保存" }).click();

  expect(createPayload).toMatchObject({ name: "new-post.md" });
  expect((createPayload as { content: string }).content).toContain("# New title");
  expect((createPayload as { content: string }).content).toContain("React draft body.");
  await expect(page).toHaveURL(/\?post=new-post\.md$/);
  expect(
    await page.evaluate(() => Object.keys(localStorage).filter((key) => key.includes(":draft:v1:"))),
  ).toEqual([]);
});

test("keeps the React new article editor usable without localStorage", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage unavailable", "QuotaExceededError");
    };
  });
  await mockCmsApi(page);
  await openReactNewPostEditor(page);

  const textarea = page.getByLabel("Markdown本文");
  await textarea.fill(`${await textarea.inputValue()}Still editable.\n`);
  await expect(page.getByText(/端末下書きを保存できません/)).toBeVisible();
  await expect(textarea).toHaveValue(/Still editable/);
});

test("tracks React publication from pending to published", async ({ page }) => {
  await mockCmsApi(page, { deploymentStates: ["pending", "running", "published"] });
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await page.getByLabel("Markdown本文").fill("# Publish from React\n");
  await page.getByRole("button", { name: "GitHubへ保存" }).click();

  const deployment = page.locator(".deployment-status");
  await expect(deployment).toContainText("build待ち");
  await deployment.getByRole("button", { name: "公開状況を再確認" }).click();
  await expect(deployment).toContainText("公開処理を実行中");
  await deployment.getByRole("button", { name: "公開状況を再確認" }).click();
  await expect(deployment).toContainText("公開済み");
  await expect(deployment.getByRole("link", { name: "GitHub Actionsを開く" })).toBeVisible();
});

test("shows React deployment failure without losing the saved article", async ({ page }) => {
  await mockCmsApi(page, { deploymentStates: ["failed"] });
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await page.getByLabel("Markdown本文").fill("# Saved before failure\n");
  await page.getByRole("button", { name: "GitHubへ保存" }).click();

  await expect(page.locator(".deployment-status")).toContainText("公開処理に失敗しました");
  await expect(page.getByRole("heading", { name: "Saved before failure" })).toBeVisible();
});

test("renames a React article after exact filename confirmation", async ({ page }) => {
  let renamePayload: unknown;
  await mockCmsApi(page, {
    onRename: (payload) => {
      renamePayload = payload;
    },
  });
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "slug変更", exact: true }).click();
  await page.getByLabel("新しいslug").fill("renamed-post");
  const submit = page.getByRole("button", { name: "slugを変更", exact: true });
  await expect(submit).toBeDisabled();
  await page.getByLabel("確認用filename").fill(EXISTING_NAME);
  await submit.click();

  expect(renamePayload).toMatchObject({
    newName: "renamed-post.md",
    confirmation: EXISTING_NAME,
    sha: "a".repeat(40),
    content: EXISTING_CONTENT,
  });
  await expect(page).toHaveURL(/\?post=renamed-post\.md$/);
  await expect(page.getByRole("heading", { name: "renamed-post.md" })).toBeVisible();
  await expect(page.locator(".deployment-status")).toContainText("公開済み");
});

test("keeps the React rename panel open on conflict", async ({ page }) => {
  await mockCmsApi(page, { renameConflict: true });
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "slug変更", exact: true }).click();
  await page.getByLabel("新しいslug").fill("renamed-post");
  await page.getByLabel("確認用filename").fill(EXISTING_NAME);
  await page.getByRole("button", { name: "slugを変更", exact: true }).click();

  await expect(page.getByText(/元記事が更新されたか、新slugが既に存在します/)).toBeVisible();
  await expect(page.locator(".rename-panel")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`\\?post=${EXISTING_NAME}$`));
});

test("deletes a React article after exact filename confirmation", async ({ page }) => {
  let deletePayload: unknown;
  await mockCmsApi(page, {
    onDelete: (payload) => {
      deletePayload = payload;
    },
  });
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "削除", exact: true }).click();
  const submit = page.getByRole("button", { name: "記事を削除", exact: true });
  await expect(submit).toBeDisabled();
  await page.getByLabel("削除確認").fill(EXISTING_NAME);
  await submit.click();

  expect(deletePayload).toEqual({ sha: "a".repeat(40), confirmation: EXISTING_NAME });
  await expect(page.getByText(/GitHubから記事を削除しました/)).toBeVisible();
  await expect(page.getByRole("button", { name: "編集", exact: true })).toBeHidden();
  await expect(page.getByRole("link", { name: "旧公開ページを確認" })).toBeVisible();
  await expect(page.locator(".deployment-status")).toContainText("公開サイトからの削除が反映されました");
});

test("keeps a React article visible when deletion conflicts", async ({ page }) => {
  await mockCmsApi(page, { deleteConflict: true });
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await page.getByLabel("削除確認").fill(EXISTING_NAME);
  await page.getByRole("button", { name: "記事を削除", exact: true }).click();

  await expect(page.getByText(/記事が他の場所で更新されています/)).toBeVisible();
  await expect(page.locator(".delete-panel")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Existing title" })).toBeVisible();
});

test("keeps React saved state when deployment lookup fails", async ({ page }) => {
  await mockCmsApi(page, { deploymentError: true });
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await page.getByLabel("Markdown本文").fill("# Saved with status error\n");
  await page.getByRole("button", { name: "GitHubへ保存" }).click();

  await expect(page.locator(".deployment-status")).toContainText("記事は保存済みですが、公開状況を取得できません");
  await expect(page.getByRole("heading", { name: "Saved with status error" })).toBeVisible();
});
