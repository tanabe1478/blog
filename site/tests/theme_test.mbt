///|
fn test_content(
  index_source? : String = (
    #|---
    #|profile: "@t__nabe1478 · Server-side engineer"
    #|rss: 更新は RSS で受け取れます。
    #|---
    #|#
    #|
    #|Profile **bio**.
  ),
  pinned? : Bool = true,
) -> @ssg.PublishedContent {
  let pin = if pinned { "\npinned: true" } else { "" }
  @ssg.build_published_content(
    index_source,
    [
      {
        id: "posts",
        index_source: Some("# My posts"),
        items: [
          {
            slug: "older",
            source: (
              #|---
              #|date: 2024-01-02 03:04
              #|description: Older & useful
              #|tags: 技術
              #|---
              #|# Older title
            ),
          },
          {
            slug: "newer",
            source: "---\ndate: 2025-06-07 08:09\ntags: diary, 技術\nimage: /images/post.png" +
            pin +
            "\n---\n# Newer title\n\nA first paragraph that is long enough.",
          },
        ],
      },
    ],
    [
      {
        path: "about",
        source: (
          #|---
          #|subtitle: Server-side engineer
          #|---
          #|# tanabe1478
          #|
          #|About **me**.
          #|
          #|## This blog
          #|
          #|Built with moonbit-ssg.
        ),
      },
    ],
  )
}

///|
fn factory() -> @ssg.PublishHTMLFactory {
  @site.blog_html_factory(@site.blog_config())
}

///|
fn index_html(content? : @ssg.PublishedContent = test_content()) -> String {
  (factory().make_index)(content.index, content)
}

///|
fn item_html(slug : String) -> String {
  let content = test_content()
  let item = content.all_items().filter(fn(item) { item.relative_path == slug })[0]
  (factory().make_item)(item, content)
}

///|
fn before(html : String, first : String, second : String) -> Bool {
  match (html.find(first), html.find(second)) {
    (Some(a), Some(b)) => a < b
    _ => false
  }
}

///|
test "header links to the main pages and marks the current one" {
  let html = index_html()
  assert_true(html.contains("<a class=\"site-name\" href=\"/\">tanabe1478</a>"))
  assert_true(html.contains("<a href=\"/\" aria-current=\"page\">Top</a>"))
  assert_true(html.contains("<a href=\"/posts/\">Articles</a>"))
  assert_true(html.contains("<a href=\"/about/\">About</a>"))
  assert_true(
    item_html("newer").contains(
      "<a href=\"/posts/\" aria-current=\"page\">Articles</a>",
    ),
  )
}

///|
test "home shows profile, pinned, recent, rss and tags in order" {
  let html = index_html()
  assert_true(
    html.contains(
      "<p class=\"profile-handle\">@t__nabe1478 · Server-side engineer</p>",
    ),
  )
  assert_true(html.contains("<p>Profile <strong>bio</strong>.</p>"))
  assert_true(
    html.contains(
      "<p class=\"rss-text\">更新は RSS で受け取れます。</p>",
    ),
  )
  assert_true(
    before(html, "class=\"section profile\"", "class=\"section pinned\""),
  )
  assert_true(
    before(html, "class=\"section pinned\"", "class=\"section recent\""),
  )
  assert_true(before(html, "class=\"section recent\"", "class=\"section rss\""))
  assert_true(before(html, "class=\"section rss\"", "class=\"section tags\""))
}

///|
test "pinned cards and recent rows show date, title, excerpt and tags" {
  let html = index_html()
  assert_true(html.contains("<a href=\"/posts/newer\">Newer title</a>"))
  assert_true(html.contains("<time datetime=\"2025-06-07\">2025.06.07</time>"))
  assert_true(html.contains("A first paragraph that is long enough."))
  assert_true(html.contains("Older &amp; useful"))
  assert_true(html.contains("<a href=\"/tags/技術\">#技術</a>"))
  assert_true(
    html.contains(
      "<a class=\"more\" href=\"/posts/\">すべての記事 →</a>",
    ),
  )
}

///|
test "home omits the pinned section when nothing is pinned" {
  assert_false(
    index_html(content=test_content(pinned=false)).contains("section pinned"),
  )
}

///|
test "tag cloud shows counts, most used first" {
  let html = index_html()
  assert_true(
    before(
      html, "<a href=\"/tags/技術\">技術 <span>2</span></a>", "<a href=\"/tags/diary\">diary <span>1</span></a>",
    ),
  )
}

///|
test "article pages show meta, title and a way back without analytics" {
  let html = item_html("newer")
  assert_true(html.contains("<h1>Newer title</h1>"))
  assert_true(html.contains("<a href=\"/tags/diary\">#diary</a>"))
  assert_true(html.contains("<a href=\"/posts/\">← 記事一覧へ</a>"))
  assert_true(html.contains("<title>Newer title | tanabe1478</title>"))
  assert_true(
    html.contains(
      "<meta name=\"og:image\" content=\"https://tanabe1478.github.io/images/post.png\"/>",
    ),
  )
  assert_false(html.contains("googletagmanager"))
}

///|
test "list pages include analytics" {
  assert_true(
    index_html().contains("googletagmanager.com/gtag/js?id=G-Q9KK5M4YNY"),
  )
}

///|
test "articles page groups posts by year" {
  let content = test_content()
  let html = (factory().make_section)(content.sections[0], content)
  assert_true(html.contains("<h1>すべての記事</h1>"))
  assert_true(
    html.contains("<p class=\"page-meta\">2 posts · 2024–2025</p>"),
  )
  assert_true(
    before(
      html, "<h2 class=\"year-label\">2025</h2>", "<h2 class=\"year-label\">2024</h2>",
    ),
  )
  assert_true(html.contains("<time datetime=\"2024-01-02\">01.02</time>"))
}

///|
test "about page renders frontmatter, body and links" {
  let content = test_content()
  let html = (factory().make_page)(content.pages[0], content)
  assert_true(
    html.contains("<a href=\"/about/\" aria-current=\"page\">About</a>"),
  )
  assert_true(html.contains("<h1>tanabe1478</h1>"))
  assert_true(html.contains("<p class=\"page-meta\">Server-side engineer</p>"))
  assert_true(html.contains("<p>About <strong>me</strong>.</p>"))
  assert_true(html.contains("<h2>This blog</h2>"))
  assert_true(html.contains("href=\"https://x.com/t__nabe1478\""))
  assert_true(html.contains("href=\"/feed.rss\""))
}

///|
test "tag details list only tagged posts" {
  let content = test_content()
  let html = (factory().make_tag_details)("diary", [], content).unwrap()
  assert_true(html.contains("<h1>#diary</h1>"))
  assert_true(html.contains("Newer title"))
  assert_false(html.contains("Older title"))
}
