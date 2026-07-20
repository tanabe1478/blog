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
    header, main { width: min(880px, calc(100% - 32px)); margin-inline: auto; }
    header { display: flex; align-items: center; justify-content: space-between; padding: 40px 0 24px; }
    h1, h2, p { margin-top: 0; }
    h1 { margin-bottom: 0; font-size: clamp(1.5rem, 4vw, 2rem); }
    .badge { padding: 6px 10px; border: 1px solid #c8c8c2; border-radius: 999px; color: #666; font-size: 0.8rem; }
    .back { display: inline-block; margin-bottom: 16px; color: #555; }
    section { padding: 24px; border: 1px solid #deded8; border-radius: 12px; background: #fff; }
    section[hidden], .back[hidden] { display: none; }
    [role="status"] { color: #666; }
    [role="status"][data-error="true"] { color: #b42318; }
    ul { display: grid; gap: 8px; margin: 20px 0 0; padding: 0; list-style: none; }
    .post-link { display: block; padding: 12px 14px; border-radius: 8px; color: inherit; text-decoration: none; background: #f4f4f0; }
    .post-link:hover, .post-link:focus-visible { background: #eaeae4; outline: none; }
    code, textarea { font-family: ui-monospace, monospace; font-size: 0.9rem; }
    textarea { width: 100%; min-height: 60vh; resize: vertical; padding: 16px; border: 1px solid #d4d4ce; border-radius: 8px; color: inherit; background: #fafaf8; line-height: 1.6; }
    .actions { display: flex; align-items: center; gap: 10px; margin: 16px 0 0; }
    .actions a { margin-left: auto; color: #315ca8; }
    button { padding: 8px 14px; border: 1px solid #c8c8c2; border-radius: 8px; color: inherit; background: #fff; cursor: pointer; }
    button.primary { border-color: #315ca8; color: #fff; background: #315ca8; }
    button:disabled { cursor: wait; opacity: 0.6; }
    button[hidden] { display: none; }
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
      <textarea id="post-content" aria-label="Markdown本文" readonly></textarea>
      <div class="actions">
        <button id="edit" type="button">編集</button>
        <button id="save" class="primary" type="button" hidden>GitHubへ保存</button>
        <button id="cancel" type="button" hidden>キャンセル</button>
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
    const postContent = document.querySelector('#post-content');
    const githubLink = document.querySelector('#github-link');
    const back = document.querySelector('#back');
    const editButton = document.querySelector('#edit');
    const saveButton = document.querySelector('#save');
    const cancelButton = document.querySelector('#cancel');
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
            const name = document.createElement('code');
            name.textContent = post.name;
            link.className = 'post-link';
            link.href = '/?post=' + encodeURIComponent(post.name);
            link.append(name);
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
        })
        .catch(() => {
          detailStatus.dataset.error = 'true';
          detailStatus.textContent = '記事を取得できませんでした。一覧へ戻って再度お試しください。';
          postContent.hidden = true;
          githubLink.hidden = true;
        });
    }

    function setEditing(editing) {
      postContent.readOnly = !editing;
      editButton.hidden = editing;
      saveButton.hidden = !editing;
      cancelButton.hidden = !editing;
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
        detailStatus.textContent = 'GitHubへ保存しました。公開処理はまだ実行していません。';
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
