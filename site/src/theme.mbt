///|
fn page_title(config : BlogConfig, title : String) -> String {
  if title.is_empty() {
    config.site.name
  } else {
    "\{title} | \{config.site.name}"
  }
}

///|
fn render_head(
  config : BlogConfig,
  path : String,
  title : String,
  description : String,
  image_path : String?,
  analytics : Bool,
) -> String {
  let canonical = absolute_url(config, path)
  let title = page_title(config, title)
  let description = if description.is_empty() {
    config.site.description
  } else {
    description
  }
  let default_image = config.site.image_path.unwrap_or("")
  let social_image = absolute_url(config, image_path.unwrap_or(default_image))
  let card_type = match image_path {
    Some(_) => "summary_large_image"
    None => "summary"
  }
  let favicon = config.site.favicon_path.unwrap_or("")
  let name = config.site.name
  let analytics = if analytics && !config.analytics_id.is_empty() {
    "<script async src=\"https://www.googletagmanager.com/gtag/js?id=\{config.analytics_id}\"></script><script>window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '\{config.analytics_id}');</script>"
  } else {
    ""
  }
  "<head><meta charset=\"UTF-8\"/><meta name=\"og:site_name\" content=\"\{name}\"/><link rel=\"canonical\" href=\"\{canonical}\"/><meta name=\"twitter:url\" content=\"\{canonical}\"/><meta name=\"og:url\" content=\"\{canonical}\"/><title>\{escape_html(title)}</title><meta name=\"twitter:title\" content=\"\{title}\"/><meta name=\"og:title\" content=\"\{title}\"/><meta name=\"description\" content=\"\{description}\"/><meta name=\"twitter:description\" content=\"\{description}\"/><meta name=\"og:description\" content=\"\{description}\"/><meta name=\"twitter:card\" content=\"\{card_type}\"/><link rel=\"stylesheet\" href=\"\{config.stylesheet_path}\" type=\"text/css\"/><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"/><link rel=\"shortcut icon\" href=\"\{favicon}\" type=\"image/png\"/><link rel=\"alternate\" href=\"\{config.feed_path}\" type=\"application/rss+xml\" title=\"Subscribe to \{name}\"/><meta name=\"twitter:image\" content=\"\{social_image}\"/><meta name=\"og:image\" content=\"\{social_image}\"/>\{analytics}</head>"
}

///|
fn render_document(
  config : BlogConfig,
  path~ : String,
  title~ : String,
  description~ : String,
  body~ : String,
  item_page? : Bool = false,
  image_path? : String,
  analytics? : Bool = true,
) -> String {
  let body_class = if item_page { " class=\"item-page\"" } else { "" }
  let header = "<header><div class=\"wrapper\"><a class=\"site-name\" href=\"/\">\{escape_html(config.site.name)}</a></div></header>"
  let footer = "<footer><a href=\"/\">Home</a></footer>"
  "<!DOCTYPE html><html lang=\"\{config.site.language}\">\{render_head(config, path, title, description, image_path, analytics)}<body\{body_class}>\{header}\{body}\{footer}</body></html>"
}

///|
/// First part of `date: yyyy-MM-dd HH:mm`, shown in lists and article headers.
fn date_day(item : @ssg.PublishItem) -> String {
  match item.content.date.split(" ").to_array().get(0) {
    Some(day) => day.to_owned()
    None => item.content.date
  }
}

///|
fn render_tag_list(item : @ssg.PublishItem) -> String {
  let tags = item.tags.map(fn(tag) {
    "<li><a href=\"/tags/\{tag}\">\{escape_html(tag)}</a></li>"
  })
  "<ul class=\"tag-list\">\{tags.join("")}</ul>"
}

///|
fn render_item_list(items : Array[@ssg.PublishItem]) -> String {
  let rows = items.map(fn(item) {
    "<li><article class=\"item-row\"><span class=\"item-date\">\{date_day(item)}</span><h1><a class=\"item-title\" href=\"\{item.path()}\">\{escape_html(item.content.title)}</a></h1>\{render_tag_list(item)}<p>\{escape_html(item.content.description)}</p></article></li>"
  })
  "<ul class=\"item-list\">\{rows.join("")}</ul>"
}

///|
fn render_profile_links(config : BlogConfig) -> String {
  "<div class=\"profile-links\"><a class=\"icon-link\" href=\"\{config.x_url}\" aria-label=\"X\"><img src=\"/images/x.svg\" width=\"18\" height=\"18\"/></a><a class=\"icon-link\" href=\"\{config.github_url}\" aria-label=\"GitHub\"><img src=\"/images/github.svg\" width=\"18\" height=\"18\"/></a></div>"
}

///|
/// Newest first. Items with the same date keep their filename order.
fn items_by_descending_date(
  items : Array[@ssg.PublishItem],
) -> Array[@ssg.PublishItem] {
  let sorted = items.copy()
  sorted.sort_by(fn(left, right) { right.content.date.compare(left.content.date) })
  sorted
}

///|
fn items_tagged_with(
  content : @ssg.PublishedContent,
  tag : String,
) -> Array[@ssg.PublishItem] {
  items_by_descending_date(content.all_items()).filter(fn(item) {
    item.tags.contains(tag)
  })
}

///|
/// The blog theme as moonbit-ssg HTML callbacks.
pub fn blog_html_factory(config : BlogConfig) -> @ssg.PublishHTMLFactory {
  {
    make_index: fn(index, content) {
      let items = items_by_descending_date(content.all_items())
      render_document(
        config,
        path="/",
        title=index.title,
        description=config.site.description,
        body="<div class=\"wrapper\">\{render_profile_links(config)}<h2>Articles</h2>\{render_item_list(items)}</div>",
      )
    },
    make_section: fn(section, _) {
      render_document(
        config,
        path="/\{section.id}",
        title=section.content.title,
        description=config.site.description,
        body="<div class=\"wrapper\"><h1>\{escape_html(section.content.title)}</h1>\{render_item_list(section.items)}</div>",
      )
    },
    make_item: fn(item, _) {
      render_document(
        config,
        path=item.path(),
        title=item.content.title,
        description=item.content.description,
        body="<div class=\"wrapper\"><article><header class=\"article-header\"><h1>\{escape_html(item.content.title)}</h1><div class=\"article-meta\"><span>\{date_day(item)}</span></div></header><div class=\"content\">\{item.content.body_html}</div>\{render_tag_list(item)}</article></div>",
        item_page=true,
        image_path?=item.content.image_path,
        analytics=false,
      )
    },
    make_page: fn(page, _) {
      render_document(
        config,
        path="/\{page.path}",
        title=page.content.title,
        description=page.content.description,
        body="<div class=\"wrapper\"><div class=\"content\">\{page.content.body_html}</div></div>",
      )
    },
    make_tag_list: fn(tags, _) {
      let links = tags.map(fn(tag) {
        "<li class=\"tag\"><a href=\"/tags/\{tag}\">\{escape_html(tag)}</a></li>"
      })
      Some(
        render_document(
          config,
          path="/tags",
          title="",
          description=config.site.description,
          body="<div class=\"wrapper\"><h1>Browse all tags</h1><ul class=\"all-tags\">\{links.join("")}</ul></div>",
        ),
      )
    },
    make_tag_details: fn(tag, _, content) {
      Some(
        render_document(
          config,
          path="/tags/\{tag}",
          title="",
          description=config.site.description,
          body="<div class=\"wrapper\"><h1>Tagged with <span class=\"tag\">\{escape_html(tag)}</span></h1><a class=\"browse-all\" href=\"/tags\">Browse all tags</a>\{render_item_list(items_tagged_with(content, tag))}</div>",
        ),
      )
    },
  }
}
