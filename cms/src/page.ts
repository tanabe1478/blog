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
    section { padding: 24px; border: 1px solid #deded8; border-radius: 12px; background: #fff; }
    #status { color: #666; }
    #status[data-error="true"] { color: #b42318; }
    ul { display: grid; gap: 8px; margin: 20px 0 0; padding: 0; list-style: none; }
    a { display: block; padding: 12px 14px; border-radius: 8px; color: inherit; text-decoration: none; background: #f4f4f0; }
    a:hover, a:focus-visible { background: #eaeae4; outline: none; }
    code { font-family: ui-monospace, monospace; font-size: 0.9rem; }
  </style>
</head>
<body>
  <header>
    <h1>Blog CMS</h1>
    <span class="badge">読み取り専用</span>
  </header>
  <main>
    <section aria-labelledby="posts-heading">
      <h2 id="posts-heading">記事一覧</h2>
      <p id="status" role="status">GitHubから取得しています…</p>
      <ul id="posts"></ul>
    </section>
  </main>
  <script>
    const status = document.querySelector('#status');
    const posts = document.querySelector('#posts');

    fetch('/api/posts')
      .then((response) => {
        if (!response.ok) throw new Error('request failed');
        return response.json();
      })
      .then((data) => {
        status.textContent = data.posts.length + '件の記事';
        for (const post of data.posts) {
          const item = document.createElement('li');
          const link = document.createElement('a');
          const name = document.createElement('code');
          name.textContent = post.name;
          link.href = post.githubUrl;
          link.target = '_blank';
          link.rel = 'noreferrer';
          link.append(name);
          item.append(link);
          posts.append(item);
        }
      })
      .catch(() => {
        status.dataset.error = 'true';
        status.textContent = '記事一覧を取得できませんでした。時間を置いて再読み込みしてください。';
      });
  </script>
</body>
</html>`;
