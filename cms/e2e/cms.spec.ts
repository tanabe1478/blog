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

const HOME_CONTENT = `---
profile: "@t__nabe1478"
rss: 更新は RSS で受け取れます。
---

# 

紹介文です。
`;
const ABOUT_CONTENT = `---
subtitle: "@t__nabe1478"
---

# tanabe1478

About me.
`;

const ARTICLE_EDITOR = "Markdown本文";
const PAGE_EDITOR = "本文（Markdown）";

function editorHost(page: Page, label = ARTICLE_EDITOR) {
  return page.locator(`[data-markdown-editor="${label}"]`);
}

async function editorValue(page: Page, label = ARTICLE_EDITOR): Promise<string> {
  return editorHost(page, label).evaluate((element) => {
    const hook = (
      element as HTMLElement & { __cmsGetMarkdown?: () => string }
    ).__cmsGetMarkdown;
    return hook ? hook() : "";
  });
}

async function replaceEditorValue(
  page: Page,
  value: string,
  label = ARTICLE_EDITOR,
): Promise<void> {
  const host = editorHost(page, label);
  const content = host.locator(".cm-content");
  await expect(content).toBeVisible();
  await content.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(value);
  await expect.poll(() => editorValue(page, label)).toBe(value);
}

async function appendEditorValue(
  page: Page,
  suffix: string,
  label = ARTICLE_EDITOR,
): Promise<void> {
  await replaceEditorValue(page, `${await editorValue(page, label)}${suffix}`, label);
}

interface MockOptions {
  createConflict?: boolean;
  createError?: boolean;
  updateConflict?: boolean;
  deleteConflict?: boolean;
  renameConflict?: boolean;
  deploymentError?: boolean;
  deploymentStates?: Array<"pending" | "running" | "published" | "failed">;
  existingContent?: string;
  postDelayMs?: number;
  postError?: boolean;
  imageError?: boolean;
  imageDelayMs?: number;
  onCreate?: (payload: unknown) => void;
  onUpdate?: (payload: unknown) => void;
  onDelete?: (payload: unknown) => void;
  onRename?: (payload: unknown) => void;
  pageUpdateConflict?: boolean;
  onPageUpdate?: (name: string, payload: unknown) => void;
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
      if (options.imageDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.imageDelayMs));
      }
      if (options.imageError) {
        await route.fulfill({
          status: 502,
          json: { error: "画像をGitHubへ保存できませんでした" },
        });
        return;
      }
      const form = request.postDataBuffer()?.toString() ?? "";
      if (!form.includes('name="post"') || !form.includes(EXISTING_NAME)) {
        await route.fulfill({
          status: 400,
          json: { error: "画像を追加する記事のfilenameが不正です" },
        });
        return;
      }
      await route.fulfill({
        json: {
          image: {
            imageUrl: "/images/hello/0123456789abcdef.png",
            markdown: "![screen](/images/hello/0123456789abcdef.png)",
          },
        },
      });
      return;
    }

    if (url.pathname === "/api/pages/home" || url.pathname === "/api/pages/about") {
      const name = url.pathname.slice("/api/pages/".length);
      const path = name === "home" ? "Content/index.md" : "Content/about.md";
      if (request.method() === "GET") {
        await route.fulfill({
          json: {
            page: {
              name,
              path,
              content: name === "home" ? HOME_CONTENT : ABOUT_CONTENT,
              sha: "a".repeat(40),
              githubUrl: `https://github.com/tanabe1478/blog/blob/main/${path}`,
              publicUrl: name === "home" ? "https://tanabe1478.github.io/" : "https://tanabe1478.github.io/about/",
            },
          },
        });
        return;
      }
      if (request.method() === "PUT") {
        options.onPageUpdate?.(name, request.postDataJSON());
        if (options.pageUpdateConflict) {
          await route.fulfill({
            status: 409,
            json: { error: "ページが他の場所で更新されています。再読み込みしてください" },
          });
          return;
        }
        await route.fulfill({
          json: {
            update: {
              sha: "b".repeat(40),
              commitSha: "c".repeat(40),
              githubUrl: `https://github.com/tanabe1478/blog/blob/main/${path}`,
            },
          },
        });
        return;
      }
    }

    if (request.method() === "GET" && url.pathname === "/api/posts") {
      await route.fulfill({
        json: {
          posts: [
            {
              name: EXISTING_NAME,
              title: "Existing title",
              date: "2026-07-20 10:00",
              pinned: false,
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
      if (options.postDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.postDelayMs));
      }
      if (options.postError) {
        await route.fulfill({
          status: 502,
          json: { error: "記事を取得できませんでした" },
        });
        return;
      }
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

test("keeps the article list visible while a Suspense transition loads detail", async ({
  page,
}) => {
  await mockCmsApi(page, { postDelayMs: 700 });
  await page.goto("/");
  await page.getByRole("button", { name: /Existing title/ }).click();

  await expect(page.getByText("記事を開いています…")).toBeVisible();
  await expect(page.getByRole("heading", { name: "記事一覧" })).toBeVisible();
  await expect(page.getByText("記事を読み込んでいます…")).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Existing title", exact: true }),
  ).toBeVisible();
});

test("shows the Suspense fallback for a direct article URL", async ({ page }) => {
  await mockCmsApi(page, { postDelayMs: 500 });
  await page.goto(`/?post=${EXISTING_NAME}`);

  await expect(page.getByText("記事を読み込んでいます…")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Existing title", exact: true }),
  ).toBeVisible();
});

test("shows a recoverable error when Suspense article loading fails", async ({ page }) => {
  await mockCmsApi(page, { postError: true });
  await page.goto(`/?post=${EXISTING_NAME}`);

  await expect(
    page.getByRole("heading", { name: "記事を表示できませんでした" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("記事を取得できませんでした");
  await page.getByRole("button", { name: "記事一覧へ戻る" }).click();
  await expect(page.getByRole("heading", { name: "記事一覧" })).toBeVisible();
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

test("edits an article inline, then cancels", async ({ page }) => {
  await mockCmsApi(page);
  await page.goto(`/?post=${EXISTING_NAME}`);

  await page.getByRole("button", { name: "編集", exact: true }).click();
  const host = editorHost(page);
  await replaceEditorValue(page, "# React changed\n\nInline body.");
  await expect(host.locator(".cm-md-h1")).toHaveText("React changed");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(host).toBeHidden();
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
  await replaceEditorValue(page, "# Saved in React\n");
  await page.getByRole("button", { name: "GitHubへ保存" }).click();

  expect(updatePayload).toEqual({
    content: "# Saved in React\n",
    sha: "a".repeat(40),
  });
  await expect(editorHost(page)).toBeHidden();
  await expect(page.getByText(/GitHubへ保存しました/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Saved in React", exact: true }),
  ).toBeVisible();
});

test("reopens the cached article version after saving", async ({ page }) => {
  await mockCmsApi(page);
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await replaceEditorValue(page, "# Cached saved title\n");
  await page.getByRole("button", { name: "GitHubへ保存" }).click();
  await page.getByRole("button", { name: "← 記事一覧へ" }).click();
  await page.getByRole("button", { name: /Existing title/ }).click();

  await expect(
    page.getByRole("heading", { name: "Cached saved title", exact: true }),
  ).toBeVisible();
});

test("keeps React editor content when saving conflicts", async ({ page }) => {
  await mockCmsApi(page, { updateConflict: true });
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await replaceEditorValue(page, "# Conflict in React\n");
  await page.getByRole("button", { name: "GitHubへ保存" }).click();

  await expect(page.getByText(/記事が他の場所で更新されています/)).toBeVisible();
  await expect.poll(() => editorValue(page)).toBe("# Conflict in React\n");
  await expect(editorHost(page)).toBeVisible();
});

test("uploads a dropped image and inserts repository image Markdown inline", async ({
  page,
}) => {
  await mockCmsApi(page);
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  const host = editorHost(page);

  await host.locator(".cm-content").evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array([1, 2, 3])], "screen.png", { type: "image/png" }));
    element.dispatchEvent(
      new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }),
    );
  });

  await expect.poll(() => editorValue(page)).toContain(
    "/images/hello/0123456789abcdef.png",
  );
  await page.keyboard.press("Control+End");
  await expect(host.locator("img.cm-md-image")).toHaveAttribute(
    "src",
    "https://raw.githubusercontent.com/tanabe1478/blog/main/Resources/images/hello/0123456789abcdef.png",
  );
  await expect(page.getByText(/画像を挿入しました/)).toBeVisible();
});

test("uploads a selected image from the React file picker", async ({ page }) => {
  await mockCmsApi(page);
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await expect(editorHost(page).locator(".cm-content")).toBeVisible();

  await page.getByLabel("画像ファイル").setInputFiles({
    name: "picked.png",
    mimeType: "image/png",
    buffer: Buffer.from([1, 2, 3]),
  });

  await expect.poll(() => editorValue(page)).toContain(
    "/images/hello/0123456789abcdef.png",
  );
});

test("keeps React content when image upload fails", async ({ page }) => {
  await mockCmsApi(page, { imageError: true });
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  const before = await editorValue(page);

  await page.getByLabel("画像ファイル").setInputFiles({
    name: "failed.png",
    mimeType: "image/png",
    buffer: Buffer.from([1, 2, 3]),
  });

  await expect(page.getByText(/画像をGitHubへ保存できませんでした/)).toBeVisible();
  await expect.poll(() => editorValue(page)).toBe(before);
});

test("renders Markdown inline and reveals source on the active line", async ({ page }) => {
  await mockCmsApi(page);
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  const source = [
    "# Inline title",
    "",
    "**strong** and *emphasis* and `code` and ~~strike~~.",
    "",
    "[link](https://example.test)",
    "",
    "![alt](/images/hello/0123456789abcdef.png)",
    "",
    "> quote",
    "",
    "- one",
    "- two",
    "",
    "```mermaid",
    "graph TD; A-->B",
    "```",
    "",
  ].join("\n");
  await replaceEditorValue(page, source);
  const host = editorHost(page);

  await expect(page.locator(".markdown-article")).toHaveCount(0);
  await expect(host.locator(".cm-md-h1")).toHaveText("Inline title");
  await expect(host.locator(".cm-md-strong")).toHaveText("strong");
  await expect(host.locator(".cm-md-emphasis")).toHaveText("emphasis");
  await expect(host.locator(".cm-md-code-inline")).toHaveText("code");
  await expect(host.locator(".cm-md-strike")).toHaveText("strike");
  await expect(host.locator(".cm-md-link")).toHaveText("link");
  await expect(host.locator("img.cm-md-image")).toHaveAttribute(
    "src",
    "https://raw.githubusercontent.com/tanabe1478/blog/main/Resources/images/hello/0123456789abcdef.png",
  );
  await expect(host.locator(".cm-md-badge-mermaid")).toHaveText("mermaid");
  await expect(host.locator(".cm-md-quote")).toContainText("quote");
  await expect(host.locator(".cm-md-list")).toHaveCount(2);
  await expect.poll(() => editorValue(page)).toBe(source);

  await host.locator(".cm-md-h1").click();
  await expect(host.locator(".cm-md-h1")).toHaveText("# Inline title");
});

test("applies CodeMirror styles under the per-response CSP nonce", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) {
      violations.push(message.text());
    }
  });
  await mockCmsApi(page);
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  const host = editorHost(page);
  const content = host.locator(".cm-content");
  await expect(content).toBeVisible();

  const nonce = await page
    .locator('meta[name="csp-nonce"]')
    .getAttribute("content");
  expect(nonce).toMatch(/^[0-9a-f]{32}$/);
  const styleNonces = await page.evaluate(() =>
    Array.from(document.querySelectorAll("style")).map(
      (style) => style.nonce || style.getAttribute("nonce") || "",
    ),
  );
  expect(styleNonces).toContain(nonce);
  await expect(content).toHaveCSS("white-space", "break-spaces");
  await expect(content).toHaveCSS("padding", "18px 20px");

  const freshResponse = await page.evaluate(async () => {
    const response = await fetch(location.href, { cache: "no-store" });
    const html = await response.text();
    return {
      nonce:
        html.match(/<meta name="csp-nonce" content="([0-9a-f]{32})">/)?.[1] ?? "",
      csp: response.headers.get("content-security-policy") ?? "",
    };
  });
  expect(freshResponse.nonce).toMatch(/^[0-9a-f]{32}$/);
  expect(freshResponse.csp).toContain(`'nonce-${freshResponse.nonce}'`);
  expect(freshResponse.csp).not.toContain("'unsafe-inline'");
  expect(violations).toEqual([]);
});

test("loads the CodeMirror chunk only when editing starts", async ({ page }) => {
  const chunks: string[] = [];
  page.on("request", (request) => {
    if (/\/assets\/MarkdownEditor-.*\.js/.test(request.url())) {
      chunks.push(request.url());
    }
  });
  await mockCmsApi(page);
  await page.goto(`/?post=${EXISTING_NAME}`);
  await expect(
    page.getByRole("heading", { name: "Existing title", exact: true }),
  ).toBeVisible();
  expect(chunks).toEqual([]);

  await page.getByRole("button", { name: "編集", exact: true }).click();
  await expect(editorHost(page).locator(".cm-content")).toBeVisible();
  await expect.poll(() => chunks.length).toBeGreaterThan(0);
});

test("inserts an uploaded image at the captured anchor after typing", async ({
  page,
}) => {
  await mockCmsApi(page, { imageDelayMs: 600 });
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await replaceEditorValue(page, "before after\n");
  const content = editorHost(page).locator(".cm-content");
  await content.click();
  await page.keyboard.press("Control+Home");
  for (let index = 0; index < 7; index++) {
    await page.keyboard.press("ArrowRight");
  }

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "画像を選択 / ドロップ" }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "during-typing.png",
    mimeType: "image/png",
    buffer: Buffer.from([1, 2, 3]),
  });
  await expect(page.getByText("画像をGitHubへ保存しています…")).toBeVisible();

  await content.focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.insertText(" typed");
  await expect(page.getByText(/画像を挿入しました/)).toBeVisible();

  const value = await editorValue(page);
  expect(value).toContain("/images/hello/0123456789abcdef.png");
  expect(value).toContain("after typed");
  expect(value.indexOf("/images/hello/0123456789abcdef.png")).toBeLessThan(
    value.indexOf("after typed"),
  );
});

test("preserves CRLF when editing and saving", async ({ page }) => {
  const crlf = EXISTING_CONTENT.replace(/\n/g, "\r\n");
  let updatePayload: unknown;
  await mockCmsApi(page, {
    existingContent: crlf,
    onUpdate: (payload) => {
      updatePayload = payload;
    },
  });
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await expect(editorHost(page).locator(".cm-content")).toBeVisible();
  expect(await editorValue(page)).toBe(crlf);

  const pinned = page.getByLabel("トップに固定表示（Pinned）");
  await pinned.check();
  await expect.poll(() => editorValue(page)).toBe(
    crlf.replace("tags: 技術\r\n", "tags: 技術\r\npinned: true\r\n"),
  );
  await pinned.uncheck();
  await expect.poll(() => editorValue(page)).toBe(crlf);

  const content = editorHost(page).locator(".cm-content");
  await content.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.insertText("!");
  await expect.poll(() => editorValue(page)).toBe(`${crlf}!`);
  await page.getByRole("button", { name: "GitHubへ保存" }).click();

  expect(updatePayload).toEqual({
    content: `${crlf}!`,
    sha: "a".repeat(40),
  });
});

test("accepts Japanese IME composition without rewriting the editor", async ({
  page,
}) => {
  await mockCmsApi(page);
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await replaceEditorValue(page, "入力: ");
  const content = editorHost(page).locator(".cm-content");
  await content.click();
  await page.keyboard.press("Control+End");

  const client = await page.context().newCDPSession(page);
  await client.send("Input.imeSetComposition", {
    text: "にほん",
    selectionStart: 3,
    selectionEnd: 3,
  });
  await client.send("Input.insertText", { text: "日本" });

  await expect.poll(() => editorValue(page)).toBe("入力: 日本");
});

test("continues and exits Markdown lists", async ({ page }) => {
  await mockCmsApi(page);
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await replaceEditorValue(page, "intro\n\n");
  const content = editorHost(page).locator(".cm-content");
  await content.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("- hogehoge");
  await page.keyboard.press("Enter");
  await expect.poll(() => editorValue(page)).toBe("intro\n\n- hogehoge\n- ");
  await page.keyboard.type("child");
  await page.keyboard.press("Enter");
  await expect.poll(() => editorValue(page)).toBe(
    "intro\n\n- hogehoge\n- child\n- ",
  );
  await page.keyboard.press("Enter");
  await expect.poll(() => editorValue(page)).toBe(
    "intro\n\n- hogehoge\n- child\n",
  );
});

test("continues ordered lists, task lists, and blockquotes", async ({ page }) => {
  await mockCmsApi(page);
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  const content = editorHost(page).locator(".cm-content");

  await replaceEditorValue(page, "intro\n\n1. one");
  await content.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("two");
  await expect.poll(() => editorValue(page)).toBe("intro\n\n1. one\n2. two");

  await replaceEditorValue(page, "intro\n\n- [ ] task");
  await content.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("next");
  await expect.poll(() => editorValue(page)).toBe(
    "intro\n\n- [ ] task\n- [ ] next",
  );

  await replaceEditorValue(page, "intro\n\n- [x] done");
  await content.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await expect.poll(() => editorValue(page)).toBe("intro\n\n- [x] done\n- [ ] ");

  await replaceEditorValue(page, "intro\n\n> quote");
  await content.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("more");
  await expect.poll(() => editorValue(page)).toBe("intro\n\n> quote\n> more");
  await page.keyboard.press("Enter");
  await expect.poll(() => editorValue(page)).toBe("intro\n\n> quote\n> more\n> ");
  await page.keyboard.press("Enter");
  await expect.poll(() => editorValue(page)).toBe("intro\n\n> quote\n> more\n");
});

test("indents and outdents Markdown list items with Tab", async ({ page }) => {
  await mockCmsApi(page);
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await replaceEditorValue(page, "- item");
  const content = editorHost(page).locator(".cm-content");
  await content.click();
  await page.keyboard.press("Control+End");

  await page.keyboard.press("Tab");
  await expect.poll(() => editorValue(page)).toBe("  - item");
  await expect(content).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect.poll(() => editorValue(page)).toBe("- item");

  await replaceEditorValue(page, "paragraph");
  await content.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Tab");
  await expect(content).not.toBeFocused();
});

test("wraps and unwraps bold, and italic beats selectParentSyntax", async ({
  page,
}) => {
  await mockCmsApi(page);
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await replaceEditorValue(page, "word");
  const content = editorHost(page).locator(".cm-content");
  await content.click();

  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Shift+End");
  await page.keyboard.press("ControlOrMeta+b");
  await expect.poll(() => editorValue(page)).toBe("**word**");
  await page.keyboard.press("ControlOrMeta+b");
  await expect.poll(() => editorValue(page)).toBe("word");

  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Shift+End");
  await page.keyboard.press("ControlOrMeta+i");
  await expect.poll(() => editorValue(page)).toBe("*word*");
});

test("applies strike, inline code, and link keyboard shortcuts", async ({ page }) => {
  await mockCmsApi(page);
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  const content = editorHost(page).locator(".cm-content");

  await replaceEditorValue(page, "word");
  await content.click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Shift+End");
  await page.keyboard.press("ControlOrMeta+Shift+x");
  await expect.poll(() => editorValue(page)).toBe("~~word~~");

  await replaceEditorValue(page, "word");
  await content.click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Shift+End");
  await page.keyboard.press("Alt+Shift+5");
  await expect.poll(() => editorValue(page)).toBe("~~word~~");

  await replaceEditorValue(page, "word");
  await content.click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Shift+End");
  await page.keyboard.press("ControlOrMeta+Shift+Backquote");
  await expect.poll(() => editorValue(page)).toBe("`word`");

  await replaceEditorValue(page, "word");
  await content.click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Shift+End");
  await page.keyboard.press("ControlOrMeta+k");
  await expect.poll(() => editorValue(page)).toBe("[word]()");
});

test("does not continue YAML lists in frontmatter", async ({ page }) => {
  const source = [
    "---",
    "date: 2026-07-20 10:00",
    "tags:",
    "  - 技術",
    "---",
    "",
    "# Existing title",
    "",
  ].join("\n");
  await mockCmsApi(page, { existingContent: source });
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  const content = editorHost(page).locator(".cm-content");
  await content.click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");

  await expect
    .poll(async () => (await editorValue(page)).includes("  - 技術\n  - "))
    .toBe(false);
  await expect.poll(async () => (await editorValue(page)).length).toBeGreaterThan(
    source.length,
  );
});

test("recovers and discards an existing React draft", async ({ page }) => {
  await mockCmsApi(page);
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  const draftContent = "# React draft\n\nReload後も残る本文。";
  await replaceEditorValue(page, draftContent);
  await expect(page.getByText(/下書きをこの端末に保存しました/)).toBeVisible();

  await page.reload();
  await expect(page.getByText(/この端末に未保存の下書きがあります/)).toBeVisible();
  await page.getByRole("button", { name: "下書きを復元" }).click();
  await expect.poll(() => editorValue(page)).toBe(draftContent);
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
  await expect.poll(() => editorValue(page)).toBe("# Stale React draft\n");
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
  await appendEditorValue(page, "React draft body.\n");
  await expect(page.getByText(/下書きをこの端末に保存しました/)).toBeVisible();

  await page.reload();
  await expect(page.getByText(/この端末に未保存の下書きがあります/)).toBeVisible();
  await page.getByRole("button", { name: "下書きを復元" }).click();
  await expect.poll(() => editorValue(page)).toContain("React draft body");
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

  await appendEditorValue(page, "Still editable.\n");
  await expect(page.getByText(/端末下書きを保存できません/)).toBeVisible();
  await expect.poll(() => editorValue(page)).toContain("Still editable");
});

test("tracks React publication from pending to published", async ({ page }) => {
  await mockCmsApi(page, { deploymentStates: ["pending", "running", "published"] });
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await replaceEditorValue(page, "# Publish from React\n");
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
  await replaceEditorValue(page, "# Saved before failure\n");
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
  await replaceEditorValue(page, "# Saved with status error\n");
  await page.getByRole("button", { name: "GitHubへ保存" }).click();

  await expect(page.locator(".deployment-status")).toContainText("記事は保存済みですが、公開状況を取得できません");
  await expect(page.getByRole("heading", { name: "Saved with status error" })).toBeVisible();
});

test("edits the Home profile, RSS text and introduction", async ({ page }) => {
  let saved: { name: string; payload: unknown } | undefined;
  await mockCmsApi(page, {
    onPageUpdate: (name, payload) => {
      saved = { name, payload };
    },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Homeを編集" }).click();

  await expect(page.getByLabel("プロフィール")).toHaveValue("@t__nabe1478");
  await expect(page.getByLabel("RSSの案内")).toHaveValue("更新は RSS で受け取れます。");
  await expect.poll(() => editorValue(page, PAGE_EDITOR)).toBe("紹介文です。\n");
  await expect(page.getByRole("textbox", { name: PAGE_EDITOR })).toBeVisible();
  const save = page.getByRole("button", { name: "ページをGitHubへ保存" });
  await expect(save).toBeDisabled();

  await page.getByLabel("RSSの案内").fill("RSS でどうぞ");
  await replaceEditorValue(page, "新しい**紹介文**です。", PAGE_EDITOR);
  await expect(
    editorHost(page, PAGE_EDITOR).locator(".cm-md-strong"),
  ).toHaveText("紹介文");
  await save.click();

  await expect(page.getByText(/GitHubへ保存しました/)).toBeVisible();
  expect(saved).toEqual({
    name: "home",
    payload: {
      content: HOME_CONTENT.replace("更新は RSS で受け取れます。", "RSS でどうぞ").replace(
        "紹介文です。\n",
        "新しい**紹介文**です。\n",
      ),
      sha: "a".repeat(40),
    },
  });
  await expect(save).toBeDisabled();
});

test("edits the About title and subtitle", async ({ page }) => {
  let saved: { name: string; payload: unknown } | undefined;
  await mockCmsApi(page, {
    onPageUpdate: (name, payload) => {
      saved = { name, payload };
    },
  });
  await page.goto("/?page=about");

  await expect(page.getByLabel("タイトル", { exact: true })).toHaveValue("tanabe1478");
  await page.getByLabel("タイトル", { exact: true }).fill("New name");
  await page.getByLabel("サブタイトル").fill("Engineer");
  await page.getByRole("button", { name: "ページをGitHubへ保存" }).click();

  await expect(page.getByText(/GitHubへ保存しました/)).toBeVisible();
  expect(saved).toEqual({
    name: "about",
    payload: {
      content: ABOUT_CONTENT.replace('"@t__nabe1478"', "Engineer").replace("# tanabe1478", "# New name"),
      sha: "a".repeat(40),
    },
  });
});

test("keeps page edits when saving conflicts", async ({ page }) => {
  await mockCmsApi(page, { pageUpdateConflict: true });
  await page.goto("/?page=about");
  await page.getByLabel("サブタイトル").fill("Engineer");
  await page.getByRole("button", { name: "ページをGitHubへ保存" }).click();

  await expect(page.getByText(/ページが他の場所で更新されています/)).toBeVisible();
  await expect(page.getByLabel("サブタイトル")).toHaveValue("Engineer");
});

test("pins an article to the top page through its frontmatter", async ({ page }) => {
  let updatePayload: unknown;
  await mockCmsApi(page, {
    onUpdate: (payload) => {
      updatePayload = payload;
    },
  });
  await page.goto(`/?post=${EXISTING_NAME}`);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  const pinned = page.getByLabel("トップに固定表示（Pinned）");
  await expect(pinned).not.toBeChecked();

  await pinned.check();
  await expect.poll(() => editorValue(page)).toBe(
    EXISTING_CONTENT.replace("tags: 技術\n", "tags: 技術\npinned: true\n"),
  );
  await pinned.uncheck();
  await expect.poll(() => editorValue(page)).toBe(EXISTING_CONTENT);
  await pinned.check();
  await page.getByRole("button", { name: "GitHubへ保存" }).click();

  expect(updatePayload).toEqual({
    content: EXISTING_CONTENT.replace("tags: 技術\n", "tags: 技術\npinned: true\n"),
    sha: "a".repeat(40),
  });
});

test("pins an article from the list with its current SHA", async ({ page }) => {
  let updatePayload: unknown;
  await mockCmsApi(page, {
    onUpdate: (payload) => {
      updatePayload = payload;
    },
  });
  await page.goto("/");
  await expect(page.getByText("1件の記事 · Pinned 0件")).toBeVisible();
  const row = page.locator(".post-list > li", { hasText: "Existing title" });
  await row.getByRole("button", { name: "ピン留め", exact: true }).click();

  await expect(row.getByRole("button", { name: "ピンを外す", exact: true })).toBeVisible();
  await expect(row.locator(".pinned-badge")).toHaveText("Pinned");
  await expect(page.getByText("1件の記事 · Pinned 1件")).toBeVisible();
  await expect(page.getByText(/Pinnedを更新しました/)).toBeVisible();
  expect(updatePayload).toEqual({
    content: EXISTING_CONTENT.replace("tags: 技術\n", "tags: 技術\npinned: true\n"),
    sha: "a".repeat(40),
  });
});

test("keeps the pinned state when pinning from the list conflicts", async ({ page }) => {
  await mockCmsApi(page, { updateConflict: true });
  await page.goto("/");
  const row = page.locator(".post-list > li", { hasText: "Existing title" });
  await row.getByRole("button", { name: "ピン留め", exact: true }).click();

  await expect(page.getByText(/記事が他の場所で更新されています/)).toBeVisible();
  await expect(row.getByRole("button", { name: "ピン留め", exact: true })).toBeVisible();
  await expect(row.locator(".pinned-badge")).toHaveCount(0);
});
