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
    #posts { display: grid; gap: 8px; margin: 20px 0 0; padding: 0; list-style: none; }
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
    .actions a { margin-left: auto; color: #315ca8; }
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
      <h2 id="posts-heading">記事一覧</h2>
      <p id="list-status" role="status">GitHubから取得しています…</p>
      <ul id="posts"></ul>
    </section>
    <section id="detail" aria-labelledby="post-heading" hidden>
      <h2 id="post-heading">記事</h2>
      <p id="detail-status" role="status">Markdownを取得しています…</p>
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
        <a id="github-link" target="_blank" rel="noreferrer">GitHubで元ファイルを開く</a>
      </div>
    </section>
  </main>
  <script>
    const list = document.querySelector('#list');
    const listStatus = document.querySelector('#list-status');
    const posts = document.querySelector('#posts');
    const detail = document.querySelector('#detail');
    const detailStatus = document.querySelector('#detail-status');
    const postHeading = document.querySelector('#post-heading');
    const editorGrid = document.querySelector('#editor-grid');
    const postContent = document.querySelector('#post-content');
    const preview = document.querySelector('#preview');
    const githubLink = document.querySelector('#github-link');
    const back = document.querySelector('#back');
    const editButton = document.querySelector('#edit');
    const saveButton = document.querySelector('#save');
    const cancelButton = document.querySelector('#cancel');
    const uploadLabel = document.querySelector('#upload');
    const imageInput = document.querySelector('#image');
    const selectedPost = new URLSearchParams(location.search).get('post');
    let currentSha = '';
    let originalContent = '';

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
          githubLink.href = data.post.githubUrl;
          setEditing(false);
        })
        .catch(() => {
          detailStatus.dataset.error = 'true';
          detailStatus.textContent = '記事を取得できませんでした。一覧へ戻って再度お試しください。';
          postContent.hidden = true;
          githubLink.hidden = true;
        });
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

    postContent.addEventListener('input', renderPreview);

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

    editButton.addEventListener('click', () => {
      delete detailStatus.dataset.error;
      detailStatus.textContent = '編集中です。保存するとGitHubのmainブランチへ反映されます。';
      setEditing(true);
    });

    cancelButton.addEventListener('click', () => {
      postContent.value = originalContent;
      detailStatus.textContent = selectedPost ? '変更を破棄しました。' : '';
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
        const response = await fetch('/api/posts/' + encodeURIComponent(selectedPost), {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ content: postContent.value, sha: currentSha }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '保存に失敗しました');
        currentSha = data.update.sha;
        originalContent = postContent.value;
        detailStatus.textContent = 'GitHubへ保存しました。公開処理はGitHub Actionsで進みます。';
        setEditing(false);
      } catch (error) {
        detailStatus.dataset.error = 'true';
        detailStatus.textContent = error instanceof Error ? error.message : '記事を保存できませんでした。';
      } finally {
        saveButton.disabled = false;
      }
    });

    addEventListener('beforeunload', (event) => {
      if (!postContent.readOnly && postContent.value !== originalContent) {
        event.preventDefault();
      }
    });

    if (selectedPost) {
      loadPost(selectedPost);
    } else {
      loadPosts();
    }
  </script>
</body>
</html>`;
