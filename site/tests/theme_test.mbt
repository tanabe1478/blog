///|
fn test_content() -> @ssg.PublishedContent {
  @ssg.build_published_content(
    "# ",
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
            source: (
              #|---
              #|date: 2025-06-07 08:09
              #|description: ""
              #|tags: diary, 技術
              #|image: /images/post.png
              #|---
              #|# Newer title
              #|
              #|Body
            ),
          },
        ],
      },
    ],
    [],
  )
}

///|
fn index_html() -> String {
  let content = test_content()
  (@site.blog_html_factory(@site.blog_config()).make_index)(
    content.index,
    content,
  )
}

///|
fn item_html(slug : String) -> String {
  let content = test_content()
  let item = content.all_items().filter(fn(item) { item.relative_path == slug })[0]
  (@site.blog_html_factory(@site.blog_config()).make_item)(item, content)
}

///|
test "index lists posts newest first" {
  let html = index_html()
  let newer = html.find("Newer title").unwrap()
  let older = html.find("Older title").unwrap()
  assert_true(newer < older)
}

///|
test "index uses the site name as its title and links tags" {
  let html = index_html()
  assert_true(html.contains("<title>tanabe1478</title>"))
  assert_true(html.contains("<a href=\"/tags/技術\">技術</a>"))
  assert_true(html.contains("Older &amp; useful"))
}

///|
test "item pages omit analytics and use the post image for social cards" {
  let html = item_html("newer")
  assert_false(html.contains("googletagmanager"))
  assert_true(html.contains("<title>Newer title | tanabe1478</title>"))
  assert_true(
    html.contains(
      "<meta name=\"og:image\" content=\"https://tanabe1478.github.io/images/post.png\"/>",
    ),
  )
  assert_true(html.contains("<body class=\"item-page\">"))
}

///|
test "list pages include analytics" {
  assert_true(
    index_html().contains("googletagmanager.com/gtag/js?id=G-Q9KK5M4YNY"),
  )
}

///|
test "tag details list only tagged posts" {
  let content = test_content()
  let factory = @site.blog_html_factory(@site.blog_config())
  let html = (factory.make_tag_details)("diary", [], content).unwrap()
  assert_true(html.contains("Newer title"))
  assert_false(html.contains("Older title"))
}
