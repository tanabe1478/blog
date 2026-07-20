export const cmsPage = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Blog CMS</title>
  <style>
    :root {
      color-scheme: light;
      font-family: ui-sans-serif, system-ui, sans-serif;
      color: #202124;
      background: #f7f7f5;
    }
    * { box-sizing: border-box; }
    body { margin: 0; }
    header, main { width: min(1200px, calc(100% - 32px)); margin-inline: auto; }
    header { display: flex; align-items: center; justify-content: space-between; padding: 40px 0 24px; }
    h1, h2, p { margin-top: 0; }
    h1 { margin-bottom: 0; font-size: clamp(1.5rem, 4vw, 2rem); }
    .badge { padding: 6px 10px; border: 1px solid #c8c8c2; border-radius: 999px; color: #666; font-size: 0.8rem; }
    .back { display: inline-block; margin-bottom: 16px; color: #555; }
    section { padding: 24px; border: 1px solid #deded8; border-radius: 12px; background: #fff; }
    section[hidden], .back[hidden] { display: none; }
    [role="status"] { color: #666; }
    [role="status"][data-error="true"] { color: #b42318; }
    .draft-notice { margin-bottom: 16px; padding: 14px; border: 1px solid #d4a72c; border-radius: 8px; background: #fff8dd; }
    .draft-notice[hidden] { display: none; }
    .draft-notice p { margin-bottom: 10px; }
    .draft-notice div { display: flex; gap: 10px; }
    .draft-state { min-height: 1.2em; margin: 10px 0 0; color: #666; font-size: 0.8rem; }
    .deployment-status { margin-top: 16px; padding: 14px; border: 1px solid #c8c8c2; border-radius: 8px; background: #f4f4f0; }
    .deployment-status[hidden] { display: none; }
    .deployment-status[data-state="published"] { border-color: #3f8f5f; background: #edf8f0; }
    .deployment-status[data-state="failed"] { border-color: #b42318; background: #fff1f0; }
    .deployment-status p { margin-bottom: 10px; }
    .deployment-actions { display: flex; align-items: center; gap: 12px; }
    .deployment-actions a { color: #315ca8; }
    #public-link[data-published="true"] { padding: 4px 7px; border-radius: 5px; font-weight: 700; background: #dff3e4; }
    .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .section-heading h2 { margin-bottom: 0; }
    #posts { display: grid; gap: 8px; margin: 20px 0 0; padding: 0; list-style: none; }
    .new-post-form { display: grid; gap: 14px; max-width: 680px; margin-top: 20px; padding: 18px; border-radius: 8px; background: #f4f4f0; }
    .new-post-form[hidden] { display: none; }
    .new-post-form label { display: grid; gap: 5px; font-weight: 600; }
    .new-post-form input { width: 100%; padding: 9px 10px; border: 1px solid #c8c8c2; border-radius: 6px; color: inherit; background: #fff; font: inherit; font-weight: 400; }
    .field-help { color: #666; font-size: 0.8rem; font-weight: 400; }
    .form-actions { display: flex; gap: 10px; }
    .post-link { display: block; padding: 12px 14px; border-radius: 8px; color: inherit; text-decoration: none; background: #f4f4f0; }
    .post-link:hover, .post-link:focus-visible { background: #eaeae4; outline: none; }
    .post-title { display: block; font-weight: 650; }
    .post-meta { display: block; margin-top: 4px; color: #666; font-size: 0.78rem; }
    code, textarea { font-family: ui-monospace, monospace; font-size: 0.9rem; }
    .editor-grid[data-editing="true"] { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
    textarea { width: 100%; min-height: 60vh; resize: vertical; padding: 16px; border: 1px solid #d4d4ce; border-radius: 8px; color: inherit; background: #fafaf8; line-height: 1.6; }
    textarea[data-drag="true"] { border-color: #315ca8; outline: 3px solid #dce7fa; background: #f5f8ff; }
    .preview { min-height: 60vh; overflow-wrap: anywhere; padding: 16px 20px; border: 1px solid #d4d4ce; border-radius: 8px; background: #fff; line-height: 1.7; }
    .preview[hidden] { display: none; }
    .preview > :first-child { margin-top: 0; }
    .preview pre { overflow-x: auto; padding: 12px; border-radius: 6px; background: #f4f4f0; }
    .preview code { padding: 2px 4px; border-radius: 4px; background: #f4f4f0; }
    .preview pre code { padding: 0; background: transparent; }
    .preview img { max-width: 100%; height: auto; }
    .preview blockquote { margin-inline: 0; padding-left: 14px; border-left: 3px solid #c8c8c2; color: #555; }
    @media (max-width: 800px) { .editor-grid[data-editing="true"] { grid-template-columns: 1fr; } }
    .actions { display: flex; align-items: center; gap: 10px; margin: 16px 0 0; }
    .action-links { display: flex; gap: 14px; margin-left: auto; }
    .action-links a { color: #315ca8; }
    button { padding: 8px 14px; border: 1px solid #c8c8c2; border-radius: 8px; color: inherit; background: #fff; cursor: pointer; }
    button.primary { border-color: #315ca8; color: #fff; background: #315ca8; }
    button:disabled { cursor: wait; opacity: 0.6; }
    button[hidden], .upload[hidden] { display: none; }
    .upload { padding: 8px 14px; border: 1px solid #c8c8c2; border-radius: 8px; background: #fff; cursor: pointer; }
    .upload input { display: none; }
    .upload[data-busy="true"] { cursor: wait; opacity: 0.6; }
  </style>
</head>
<body>
  <header>
    <h1>Blog CMS</h1>
    <span class="badge">GitHub連携</span>
  </header>
  <main>
    <a id="back" class="back" href="/" hidden>← 記事一覧へ</a>
    <section id="list" aria-labelledby="posts-heading">
      <div class="section-heading">
        <h2 id="posts-heading">記事一覧</h2>
        <button id="new-post" class="primary" type="button">新規記事</button>
      </div>
      <form id="new-post-form" class="new-post-form" hidden>
        <label>
          slug
          <input id="new-slug" name="slug" required maxlength="100" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="my-new-post" autocomplete="off">
          <span class="field-help">英小文字・数字・hyphen。公開URLにも使います。</span>
        </label>
        <label>
          タイトル
          <input id="new-title" name="title" required maxlength="200" autocomplete="off">
        </label>
        <label>
          公開日時
          <input id="new-date" name="date" type="datetime-local" required>
        </label>
        <label>
          description
          <input id="new-description" name="description" maxlength="300" autocomplete="off">
        </label>
        <label>
          tags
          <input id="new-tags" name="tags" value="日記" maxlength="200" autocomplete="off">
          <span class="field-help">複数の場合はcomma区切り。</span>
        </label>
        <div class="form-actions">
          <button class="primary" type="submit">本文を編集</button>
          <button id="new-post-cancel" type="button">フォームを閉じる</button>
        </div>
      </form>
      <p id="list-status" role="status">GitHubから取得しています…</p>
      <ul id="posts"></ul>
    </section>
    <section id="detail" aria-labelledby="post-heading" hidden>
      <h2 id="post-heading">記事</h2>
      <p id="detail-status" role="status">Markdownを取得しています…</p>
      <aside id="draft-notice" class="draft-notice" hidden>
        <p id="draft-notice-text">この端末に未保存の下書きがあります。</p>
        <div>
          <button id="draft-restore" class="primary" type="button">下書きを復元</button>
          <button id="draft-discard" type="button">下書きを破棄</button>
        </div>
      </aside>
      <div id="editor-grid" class="editor-grid">
        <textarea id="post-content" aria-label="Markdown本文" readonly hidden></textarea>
        <article id="preview" class="preview" aria-label="記事プレビュー" hidden></article>
      </div>
      <div class="actions">
        <button id="edit" type="button">編集</button>
        <button id="save" class="primary" type="button" hidden>GitHubへ保存</button>
        <button id="cancel" type="button" hidden>キャンセル</button>
        <label id="upload" class="upload" hidden>
          画像を選択 / ドロップ
          <input id="image" type="file" accept="image/png,image/jpeg,image/gif,image/webp">
        </label>
        <span class="action-links">
          <a id="public-link" target="_blank" rel="noreferrer">公開ページを開く</a>
          <a id="github-link" target="_blank" rel="noreferrer">GitHubで元ファイルを開く</a>
        </span>
      </div>
      <p id="draft-state" class="draft-state" role="status"></p>
      <aside id="deployment-status" class="deployment-status" aria-live="polite" hidden>
        <p id="deployment-label">保存済み。公開処理を確認しています…</p>
        <div class="deployment-actions">
          <button id="deployment-refresh" type="button">公開状況を再確認</button>
          <a id="deployment-run-link" target="_blank" rel="noreferrer" hidden>GitHub Actionsを開く</a>
        </div>
      </aside>
    </section>
  </main>
  <script>
    const list = document.querySelector('#list');
    const listStatus = document.querySelector('#list-status');
    const posts = document.querySelector('#posts');
    const newPostButton = document.querySelector('#new-post');
    const newPostForm = document.querySelector('#new-post-form');
    const newPostCancel = document.querySelector('#new-post-cancel');
    const newSlug = document.querySelector('#new-slug');
    const newTitle = document.querySelector('#new-title');
    const newDate = document.querySelector('#new-date');
    const newDescription = document.querySelector('#new-description');
    const newTags = document.querySelector('#new-tags');
    const detail = document.querySelector('#detail');
    const detailStatus = document.querySelector('#detail-status');
    const draftNotice = document.querySelector('#draft-notice');
    const draftNoticeText = document.querySelector('#draft-notice-text');
    const draftRestore = document.querySelector('#draft-restore');
    const draftDiscard = document.querySelector('#draft-discard');
    const draftState = document.querySelector('#draft-state');
    const deploymentStatus = document.querySelector('#deployment-status');
    const deploymentLabel = document.querySelector('#deployment-label');
    const deploymentRefresh = document.querySelector('#deployment-refresh');
    const deploymentRunLink = document.querySelector('#deployment-run-link');
    const postHeading = document.querySelector('#post-heading');
    const editorGrid = document.querySelector('#editor-grid');
    const postContent = document.querySelector('#post-content');
    const preview = document.querySelector('#preview');
    const publicLink = document.querySelector('#public-link');
    const githubLink = document.querySelector('#github-link');
    const back = document.querySelector('#back');
    const editButton = document.querySelector('#edit');
    const saveButton = document.querySelector('#save');
    const cancelButton = document.querySelector('#cancel');
    const uploadLabel = document.querySelector('#upload');
    const imageInput = document.querySelector('#image');
    const searchParams = new URLSearchParams(location.search);
    const selectedPost = searchParams.get('post');
    const selectedDraft = searchParams.get('draft');
    const draftPrefix = 'blog-cms:draft:v1:' + location.host + ':';
    let activePost = selectedPost || selectedDraft;
    let creatingPost = false;
    let currentSha = '';
    let originalContent = '';
    let pendingDraft;
    let draftTimer;
    let deploymentCommit = '';
    let deploymentTimer;
    let deploymentChecks = 0;
    let deploymentLoading = false;

    function draftKey(name) {
      return draftPrefix + name;
    }

    function validDraft(value, name) {
      return value && value.version === 1 && value.name === name &&
        typeof value.content === 'string' && value.content.length <= 1_000_000 &&
        typeof value.isNew === 'boolean' && typeof value.savedAt === 'string' &&
        (value.baseSha === null || /^[0-9a-f]{40}$/.test(value.baseSha));
    }

    function readDraft(name) {
      if (!name) return undefined;
      try {
        const value = JSON.parse(localStorage.getItem(draftKey(name)) || 'null');
        return validDraft(value, name) ? value : undefined;
      } catch {
        return undefined;
      }
    }

    function removeDraft(name) {
      clearTimeout(draftTimer);
      draftTimer = undefined;
      if (!name) return;
      try {
        localStorage.removeItem(draftKey(name));
      } catch {
        // Editing must remain available even when browser storage is unavailable.
      }
      draftState.textContent = '';
    }

    function persistDraft() {
      draftTimer = undefined;
      if (postContent.readOnly || !activePost) return;
      const draft = {
        version: 1,
        name: activePost,
        content: postContent.value,
        baseSha: creatingPost ? null : currentSha,
        isNew: creatingPost,
        savedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(draftKey(activePost), JSON.stringify(draft));
        draftState.textContent = '下書きをこの端末に保存しました。共有端末では保存後に破棄してください。';
      } catch {
        draftState.textContent = '端末下書きを保存できません。本文を別の場所にも退避してください。';
      }
    }

    function scheduleDraftSave() {
      clearTimeout(draftTimer);
      draftState.textContent = '端末下書きを保存しています…';
      draftTimer = setTimeout(persistDraft, 400);
    }

    function hideDraftNotice() {
      pendingDraft = undefined;
      draftNotice.hidden = true;
      editButton.disabled = false;
    }

    function showDraftNotice(draft, latestSha = '') {
      pendingDraft = draft;
      const savedAt = new Date(draft.savedAt);
      const savedLabel = Number.isNaN(savedAt.getTime())
        ? ''
        : '（' + savedAt.toLocaleString('ja-JP') + '）';
      const conflictWarning =
        !draft.isNew && latestSha && draft.baseSha !== latestSha
          ? ' GitHub版が更新されているため、復元後の保存では競合確認が必要です。'
          : '';
      draftNoticeText.textContent =
        'この端末に未保存の下書きがあります' + savedLabel + '。' + conflictWarning;
      draftNotice.hidden = false;
      editButton.disabled = true;
    }

    function scheduleDeploymentCheck() {
      clearTimeout(deploymentTimer);
      if (deploymentChecks >= 30) {
        deploymentLabel.textContent += ' 自動確認を停止しました。必要に応じて再確認してください。';
        return;
      }
      deploymentTimer = setTimeout(refreshDeployment, 10_000);
    }

    async function refreshDeployment() {
      if (!deploymentCommit || deploymentLoading) return;
      clearTimeout(deploymentTimer);
      deploymentLoading = true;
      deploymentRefresh.disabled = true;
      deploymentChecks += 1;
      try {
        const response = await fetch('/api/deployments/' + deploymentCommit);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '公開状況を取得できませんでした');
        const deployment = data.deployment;
        deploymentStatus.dataset.state = deployment.state;
        if (deployment.runUrl) {
          deploymentRunLink.href = deployment.runUrl;
          deploymentRunLink.hidden = false;
        } else {
          deploymentRunLink.hidden = true;
        }

        if (deployment.state === 'pending') {
          deploymentLabel.textContent = '保存済み・build待ちです。';
          scheduleDeploymentCheck();
        } else if (deployment.state === 'running') {
          deploymentLabel.textContent = '公開処理を実行中です。';
          scheduleDeploymentCheck();
        } else if (deployment.state === 'published') {
          deploymentLabel.textContent = '公開済みです。';
          publicLink.dataset.published = 'true';
        } else if (deployment.state === 'failed') {
          deploymentLabel.textContent = '公開処理に失敗しました。GitHub Actionsを確認してください。';
        } else {
          throw new Error('公開状況のresponseが不正です');
        }
      } catch {
        delete deploymentStatus.dataset.state;
        deploymentLabel.textContent = '記事は保存済みですが、公開状況を取得できません。手動で再確認できます。';
      } finally {
        deploymentLoading = false;
        deploymentRefresh.disabled = false;
      }
    }

    function startDeploymentTracking(commitSha) {
      clearTimeout(deploymentTimer);
      deploymentCommit = commitSha;
      deploymentChecks = 0;
      deploymentStatus.hidden = false;
      delete deploymentStatus.dataset.state;
      delete publicLink.dataset.published;
      deploymentRunLink.hidden = true;
      deploymentLabel.textContent = '保存済み。公開処理を確認しています…';
      void refreshDeployment();
    }

    deploymentRefresh.addEventListener('click', () => {
      deploymentChecks = 0;
      void refreshDeployment();
    });

    function loadPosts() {
      fetch('/api/posts')
        .then((response) => {
          if (!response.ok) throw new Error('request failed');
          return response.json();
        })
        .then((data) => {
          listStatus.textContent = data.posts.length + '件の記事';
          for (const post of data.posts) {
            const item = document.createElement('li');
            const link = document.createElement('a');
            const title = document.createElement('span');
            const metadata = document.createElement('code');
            title.className = 'post-title';
            title.textContent = post.title;
            metadata.className = 'post-meta';
            metadata.textContent = post.date ? post.date + ' · ' + post.name : post.name;
            link.className = 'post-link';
            link.href = '/?post=' + encodeURIComponent(post.name);
            link.append(title, metadata);
            item.append(link);
            posts.append(item);
          }
        })
        .catch(() => {
          listStatus.dataset.error = 'true';
          listStatus.textContent = '記事一覧を取得できませんでした。時間を置いて再読み込みしてください。';
        });
    }

    function localDateTimeValue() {
      const now = new Date();
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
      return local.toISOString().slice(0, 16);
    }

    newPostButton.addEventListener('click', () => {
      newPostButton.hidden = true;
      newPostForm.hidden = false;
      newDate.value = localDateTimeValue();
      newSlug.focus();
    });

    newPostCancel.addEventListener('click', () => {
      newPostForm.hidden = true;
      newPostButton.hidden = false;
      newPostForm.reset();
      newTags.value = '日記';
    });

    newPostForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!newPostForm.reportValidity()) return;
      const newline = String.fromCharCode(10);
      const tags = newTags.value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .join(', ') || '日記';
      activePost = newSlug.value + '.md';
      creatingPost = true;
      currentSha = '';
      originalContent = '';
      postContent.value = [
        '---',
        'date: ' + newDate.value.replace('T', ' '),
        'description: ' + JSON.stringify(newDescription.value.trim()),
        'tags: ' + tags,
        '---',
        '',
        '# ' + newTitle.value.trim(),
        '',
        '',
      ].join(newline);
      document.title = activePost + ' - Blog CMS';
      postHeading.textContent = activePost;
      detailStatus.textContent = '未保存の新規記事です。本文を書いてからGitHubへ保存してください。';
      publicLink.hidden = true;
      githubLink.hidden = true;
      list.hidden = true;
      detail.hidden = false;
      back.hidden = false;
      history.replaceState(null, '', '/?draft=' + encodeURIComponent(activePost));
      setEditing(true);
      persistDraft();
    });

    function loadPost(name) {
      list.hidden = true;
      detail.hidden = false;
      back.hidden = false;

      fetch('/api/posts/' + encodeURIComponent(name))
        .then((response) => {
          if (!response.ok) throw new Error('request failed');
          return response.json();
        })
        .then((data) => {
          document.title = data.post.name + ' - Blog CMS';
          postHeading.textContent = data.post.name;
          detailStatus.textContent = data.post.path;
          postContent.value = data.post.content;
          originalContent = data.post.content;
          currentSha = data.post.sha;
          publicLink.href = data.post.publicUrl;
          publicLink.hidden = false;
          githubLink.href = data.post.githubUrl;
          githubLink.hidden = false;
          setEditing(false);
          const draft = readDraft(name);
          if (draft && !draft.isNew) showDraftNotice(draft, currentSha);
        })
        .catch(() => {
          detailStatus.dataset.error = 'true';
          detailStatus.textContent = '記事を取得できませんでした。一覧へ戻って再度お試しください。';
          postContent.hidden = true;
          publicLink.hidden = true;
          githubLink.hidden = true;
        });
    }

    function loadNewDraft(name) {
      const draft = readDraft(name);
      list.hidden = true;
      detail.hidden = false;
      back.hidden = false;
      publicLink.hidden = true;
      githubLink.hidden = true;
      editButton.hidden = true;
      saveButton.hidden = true;
      cancelButton.hidden = true;
      uploadLabel.hidden = true;
      postContent.hidden = true;
      preview.hidden = true;
      document.title = name + ' - Blog CMS';
      postHeading.textContent = name;
      if (!draft || !draft.isNew) {
        detailStatus.dataset.error = 'true';
        detailStatus.textContent = 'この端末に復元できる新規記事の下書きがありません。';
        return;
      }
      detailStatus.textContent = '未保存の新規記事の下書きがあります。';
      showDraftNotice(draft);
    }

    function safePreviewUrl(value, image) {
      try {
        const base = value.startsWith('/')
          ? 'https://tanabe1478.github.io/'
          : location.href;
        const url = new URL(value, base);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
        if (image && url.protocol !== 'https:') return undefined;
        return url.href;
      } catch {
        return undefined;
      }
    }

    function appendInline(container, text) {
      let offset = 0;
      while (offset < text.length) {
        const candidates = [
          text.indexOf('**', offset),
          text.indexOf('\x60', offset),
          text.indexOf('[', offset),
        ].filter((index) => index >= 0);
        if (candidates.length === 0) {
          container.append(document.createTextNode(text.slice(offset)));
          break;
        }

        const start = Math.min(...candidates);
        container.append(document.createTextNode(text.slice(offset, start)));
        if (text.startsWith('**', start)) {
          const end = text.indexOf('**', start + 2);
          if (end >= 0) {
            const strong = document.createElement('strong');
            strong.textContent = text.slice(start + 2, end);
            container.append(strong);
            offset = end + 2;
            continue;
          }
        } else if (text.startsWith('\x60', start)) {
          const end = text.indexOf('\x60', start + 1);
          if (end >= 0) {
            const code = document.createElement('code');
            code.textContent = text.slice(start + 1, end);
            container.append(code);
            offset = end + 1;
            continue;
          }
        } else {
          const labelEnd = text.indexOf('](', start + 1);
          const urlEnd = labelEnd >= 0 ? text.indexOf(')', labelEnd + 2) : -1;
          if (labelEnd >= 0 && urlEnd >= 0) {
            const href = safePreviewUrl(text.slice(labelEnd + 2, urlEnd), false);
            if (href) {
              const link = document.createElement('a');
              link.href = href;
              link.target = '_blank';
              link.rel = 'noreferrer';
              link.textContent = text.slice(start + 1, labelEnd);
              container.append(link);
              offset = urlEnd + 1;
              continue;
            }
          }
        }

        container.append(document.createTextNode(text[start]));
        offset = start + 1;
      }
    }

    function parsedImage(line) {
      if (line.startsWith('[![') && line.endsWith(')')) {
        const altEnd = line.indexOf('](', 3);
        const imageEnd = altEnd >= 0 ? line.indexOf(')](', altEnd + 2) : -1;
        if (altEnd >= 0 && imageEnd >= 0) {
          return {
            alt: line.slice(3, altEnd),
            source: line.slice(altEnd + 2, imageEnd),
            href: line.slice(imageEnd + 3, -1),
          };
        }
      }
      if (line.startsWith('![') && line.endsWith(')')) {
        const altEnd = line.indexOf('](', 2);
        if (altEnd >= 0) {
          return {
            alt: line.slice(2, altEnd),
            source: line.slice(altEnd + 2, -1),
          };
        }
      }
      return undefined;
    }

    function appendImage(container, alt, source, href) {
      const imageUrl = safePreviewUrl(source, true);
      const linkUrl = href ? safePreviewUrl(href, false) : undefined;
      if (!imageUrl) return false;
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = alt;
      image.loading = 'lazy';
      if (linkUrl) {
        const link = document.createElement('a');
        link.href = linkUrl;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.append(image);
        container.append(link);
      } else {
        container.append(image);
      }
      return true;
    }

    function isBlockStart(line) {
      return line.startsWith('#') || line.startsWith('> ') ||
        line.startsWith('- ') || line.startsWith('* ') ||
        /^[0-9]+[.] /.test(line) || line.startsWith('\x60\x60\x60') ||
        line === '---';
    }

    function renderPreview() {
      const lines = postContent.value.split(String.fromCharCode(10)).map(
        (line) => line.endsWith(String.fromCharCode(13)) ? line.slice(0, -1) : line,
      );
      if (lines[0] === '---') {
        const end = lines.indexOf('---', 1);
        if (end > 0) lines.splice(0, end + 1);
      }

      const fragment = document.createDocumentFragment();
      let index = 0;
      while (index < lines.length) {
        const line = lines[index];
        if (!line.trim()) {
          index += 1;
          continue;
        }

        if (line.startsWith('\x60\x60\x60')) {
          const language = line.slice(3).trim();
          const body = [];
          index += 1;
          while (index < lines.length && !lines[index].startsWith('\x60\x60\x60')) {
            body.push(lines[index]);
            index += 1;
          }
          if (index < lines.length) index += 1;
          const pre = document.createElement('pre');
          const code = document.createElement('code');
          if (language) code.dataset.language = language;
          code.textContent = body.join(String.fromCharCode(10));
          pre.append(code);
          fragment.append(pre);
          continue;
        }

        const heading = line.match(/^(#{1,6}) +(.+)$/);
        if (heading) {
          const element = document.createElement('h' + heading[1].length);
          appendInline(element, heading[2]);
          fragment.append(element);
          index += 1;
          continue;
        }

        const image = parsedImage(line);
        if (image) {
          const paragraph = document.createElement('p');
          const rendered = appendImage(paragraph, image.alt, image.source, image.href);
          if (!rendered) paragraph.textContent = line;
          fragment.append(paragraph);
          index += 1;
          continue;
        }

        if (line.startsWith('- ') || line.startsWith('* ')) {
          const list = document.createElement('ul');
          while (index < lines.length && (lines[index].startsWith('- ') || lines[index].startsWith('* '))) {
            const item = document.createElement('li');
            appendInline(item, lines[index].slice(2));
            list.append(item);
            index += 1;
          }
          fragment.append(list);
          continue;
        }

        if (/^[0-9]+[.] /.test(line)) {
          const list = document.createElement('ol');
          while (index < lines.length && /^[0-9]+[.] /.test(lines[index])) {
            const item = document.createElement('li');
            appendInline(item, lines[index].replace(/^[0-9]+[.] /, ''));
            list.append(item);
            index += 1;
          }
          fragment.append(list);
          continue;
        }

        if (line.startsWith('> ')) {
          const quote = document.createElement('blockquote');
          const quoted = [];
          while (index < lines.length && lines[index].startsWith('> ')) {
            quoted.push(lines[index].slice(2));
            index += 1;
          }
          appendInline(quote, quoted.join(' '));
          fragment.append(quote);
          continue;
        }

        if (line === '---') {
          fragment.append(document.createElement('hr'));
          index += 1;
          continue;
        }

        const paragraphLines = [line];
        index += 1;
        while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
          paragraphLines.push(lines[index]);
          index += 1;
        }
        const paragraph = document.createElement('p');
        appendInline(paragraph, paragraphLines.join(' '));
        fragment.append(paragraph);
      }
      preview.replaceChildren(fragment);
    }

    postContent.addEventListener('input', () => {
      renderPreview();
      scheduleDraftSave();
    });

    function setEditing(editing) {
      postContent.readOnly = !editing;
      postContent.hidden = !editing;
      editorGrid.dataset.editing = editing ? 'true' : 'false';
      preview.hidden = false;
      renderPreview();
      editButton.hidden = editing;
      saveButton.hidden = !editing;
      cancelButton.hidden = !editing;
      uploadLabel.hidden = !editing;
      if (editing) postContent.focus();
    }

    draftRestore.addEventListener('click', () => {
      if (!pendingDraft) return;
      const draft = pendingDraft;
      activePost = draft.name;
      creatingPost = draft.isNew;
      postContent.value = draft.content;
      if (draft.isNew) {
        currentSha = '';
        originalContent = '';
      } else if (draft.baseSha) {
        currentSha = draft.baseSha;
      }
      hideDraftNotice();
      draftState.textContent = '端末の下書きを復元しました。';
      detailStatus.textContent = draft.isNew
        ? '未保存の新規記事です。本文を確認してGitHubへ保存してください。'
        : '端末の下書きを編集中です。';
      setEditing(true);
    });

    draftDiscard.addEventListener('click', () => {
      if (!pendingDraft) return;
      const draft = pendingDraft;
      removeDraft(draft.name);
      hideDraftNotice();
      if (draft.isNew) {
        creatingPost = false;
        activePost = null;
        postContent.value = '';
        preview.replaceChildren();
        detail.hidden = true;
        list.hidden = false;
        back.hidden = true;
        history.replaceState(null, '', '/');
        document.title = 'Blog CMS';
        if (posts.children.length === 0) loadPosts();
      } else {
        detailStatus.textContent = '端末の下書きを破棄しました。GitHub版を表示しています。';
      }
    });

    editButton.addEventListener('click', () => {
      delete detailStatus.dataset.error;
      detailStatus.textContent = '編集中です。保存するとGitHubのmainブランチへ反映されます。';
      setEditing(true);
    });

    cancelButton.addEventListener('click', () => {
      const hasChanges = creatingPost || postContent.value !== originalContent;
      if (hasChanges && !confirm('変更と、この端末に保存した下書きを破棄しますか？')) return;
      removeDraft(activePost);
      hideDraftNotice();
      if (creatingPost) {
        creatingPost = false;
        activePost = null;
        postContent.value = '';
        originalContent = '';
        preview.replaceChildren();
        detail.hidden = true;
        list.hidden = false;
        back.hidden = true;
        newPostForm.hidden = true;
        newPostButton.hidden = false;
        newPostForm.reset();
        newTags.value = '日記';
        document.title = 'Blog CMS';
        history.replaceState(null, '', '/');
        return;
      }
      postContent.value = originalContent;
      detailStatus.textContent = '変更を破棄しました。';
      setEditing(false);
    });

    async function uploadImage(image) {
      if (imageInput.disabled) return;
      if (image.size > 10 * 1024 * 1024) {
        detailStatus.dataset.error = 'true';
        detailStatus.textContent = '画像は10MB以下にしてください。';
        return;
      }

      imageInput.disabled = true;
      uploadLabel.dataset.busy = 'true';
      delete detailStatus.dataset.error;
      detailStatus.textContent = 'Gyazoへアップロードしています…';
      try {
        const form = new FormData();
        form.append('image', image);
        const response = await fetch('/api/images', { method: 'POST', body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '画像アップロードに失敗しました');

        const start = postContent.selectionStart;
        const end = postContent.selectionEnd;
        const before = postContent.value.slice(0, start);
        const after = postContent.value.slice(end);
        const leadingNewline = before && !before.endsWith('\\n') ? '\\n' : '';
        const trailingNewline = after && !after.startsWith('\\n') ? '\\n' : '';
        const inserted = leadingNewline + data.image.markdown + trailingNewline;
        postContent.setRangeText(inserted, start, end, 'end');
        detailStatus.textContent = 'Gyazo画像を挿入しました。GitHubへ保存してください。';
        renderPreview();
        scheduleDraftSave();
        postContent.focus();
      } catch (error) {
        detailStatus.dataset.error = 'true';
        detailStatus.textContent = error instanceof Error ? error.message : '画像をアップロードできませんでした。';
      } finally {
        imageInput.disabled = false;
        delete uploadLabel.dataset.busy;
      }
    }

    imageInput.addEventListener('change', async () => {
      const image = imageInput.files?.[0];
      if (image) await uploadImage(image);
      imageInput.value = '';
    });

    function isFileDrag(event) {
      return Array.from(event.dataTransfer?.types || []).includes('Files');
    }

    for (const eventName of ['dragenter', 'dragover']) {
      postContent.addEventListener(eventName, (event) => {
        if (postContent.readOnly || !isFileDrag(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        postContent.dataset.drag = 'true';
      });
    }

    postContent.addEventListener('dragleave', () => {
      delete postContent.dataset.drag;
    });

    postContent.addEventListener('drop', async (event) => {
      if (postContent.readOnly || !isFileDrag(event)) return;
      event.preventDefault();
      delete postContent.dataset.drag;
      const files = Array.from(event.dataTransfer.files);
      if (files.length !== 1) {
        detailStatus.dataset.error = 'true';
        detailStatus.textContent = '画像は1枚ずつドロップしてください。';
        return;
      }
      await uploadImage(files[0]);
    });

    saveButton.addEventListener('click', async () => {
      saveButton.disabled = true;
      delete detailStatus.dataset.error;
      detailStatus.textContent = 'GitHubへ保存しています…';
      try {
        const isCreating = creatingPost;
        const response = await fetch(
          isCreating ? '/api/posts' : '/api/posts/' + encodeURIComponent(activePost),
          {
            method: isCreating ? 'POST' : 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(
              isCreating
                ? { name: activePost, content: postContent.value }
                : { content: postContent.value, sha: currentSha },
            ),
          },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '保存に失敗しました');
        const saved = isCreating ? data.post : data.update;
        currentSha = saved.sha;
        originalContent = postContent.value;
        removeDraft(activePost);
        hideDraftNotice();
        if (isCreating) {
          creatingPost = false;
          publicLink.href = saved.publicUrl;
          publicLink.hidden = false;
          githubLink.href = saved.githubUrl;
          githubLink.hidden = false;
          history.replaceState(null, '', '/?post=' + encodeURIComponent(activePost));
        }
        detailStatus.textContent = 'GitHubへ保存しました。公開処理はGitHub Actionsで進みます。';
        setEditing(false);
        startDeploymentTracking(saved.commitSha);
      } catch (error) {
        detailStatus.dataset.error = 'true';
        detailStatus.textContent = error instanceof Error ? error.message : '記事を保存できませんでした。';
      } finally {
        saveButton.disabled = false;
      }
    });

    addEventListener('beforeunload', (event) => {
      if (!postContent.readOnly && (creatingPost || postContent.value !== originalContent)) {
        event.preventDefault();
      }
    });

    if (selectedPost) {
      loadPost(selectedPost);
    } else if (selectedDraft) {
      loadNewDraft(selectedDraft);
    } else {
      loadPosts();
    }
  </script>
</body>
</html>`;
