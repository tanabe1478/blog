///|
fn post(slug : String, frontmatter : String, body : String) -> @ssg.PostSource {
  { slug, source: "---\n\{frontmatter}\n---\n# \{slug}\n\n\{body}", }
}

///|
fn sample() -> @ssg.PublishedContent {
  @ssg.build_published_content(
    "# ",
    [
      {
        id: "posts",
        index_source: None,
        items: [
          post(
            "a", "date: 2024-01-02 03:04\ntags: diary, 技術", "Short.\n\nFirst real paragraph with <b>markup</b> & more text here.",
          ),
          post(
            "b", "date: 2026-05-12 19:10\ndescription: Written summary\ntags: diary\npinned: true",
            "Body",
          ),
          post(
            "c", "date: 2025-12-23 14:03\ntags: 日記\npinned: true", "Body",
          ),
          post("d", "date: 2025-03-04 03:28\ntags: diary", "Body"),
        ],
      },
    ],
    [],
  )
}

///|
fn slugs(items : Array[@ssg.PublishItem]) -> Array[String] {
  items.map(fn(item) { item.relative_path })
}

///|
test "excerpt prefers the description and falls back to the first paragraph" {
  let items = sample().all_items()
  let by_slug = fn(slug : String) {
    items.filter(fn(item) { item.relative_path == slug })[0]
  }
  inspect(@site.excerpt(by_slug("b"), 80), content="Written summary")
  inspect(
    @site.excerpt(by_slug("a"), 80),
    content="First real paragraph with markup &amp; more text here.",
  )
  inspect(@site.excerpt(by_slug("a"), 10), content="First real…")
}

///|
test "pinned and recent items are newest first" {
  let content = sample()
  debug_inspect(slugs(@site.pinned_items(content)), content="[\"b\", \"c\"]")
  debug_inspect(
    slugs(@site.recent_items(content, 3)),
    content="[\"b\", \"c\", \"d\"]",
  )
}

///|
test "group items by year, newest year first" {
  let groups = @site.items_by_year(sample().all_items())
  debug_inspect(
    groups.map(fn(group) { (group.0, slugs(group.1)) }),
    content="[(\"2026\", [\"b\"]), (\"2025\", [\"c\", \"d\"]), (\"2024\", [\"a\"])]",
  )
}

///|
test "count tags, most used first and then by code point" {
  debug_inspect(
    @site.tag_counts(sample()),
    content="[(\"diary\", 3), (\"技術\", 1), (\"日記\", 1)]",
  )
}

///|
test "format dates with dots" {
  inspect(@site.dotted_date("2026-05-12 19:10"), content="2026.05.12")
  inspect(@site.dotted_date(""), content="")
}
