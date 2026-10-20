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
  let title = escape_attribute(page_title(config, title))
  let description = escape_attribute(
    if description.is_empty() {
      config.site.description
    } else {
      description
    },
  )
  let default_image = config.site.image_path.unwrap_or("")
  let social_image = absolute_url(config, image_path.unwrap_or(default_image))
  let card_type = match image_path {
    Some(_) => "summary_large_image"
    None => "summary"
  }
  let favicon = config.site.favicon_path.unwrap_or("")
  let name = escape_attribute(config.site.name)
  let analytics = if analytics && !config.analytics_id.is_empty() {
    "<script async src=\"https://www.googletagmanager.com/gtag/js?id=\{config.analytics_id}\"></script><script>window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '\{config.analytics_id}');</script>"
  } else {
    ""
  }
  "<head><meta charset=\"UTF-8\"/><meta name=\"color-scheme\" content=\"light dark\"/><meta name=\"og:site_name\" content=\"\{name}\"/><link rel=\"canonical\" href=\"\{canonical}\"/><meta name=\"twitter:url\" content=\"\{canonical}\"/><meta name=\"og:url\" content=\"\{canonical}\"/><title>\{title}</title><meta name=\"twitter:title\" content=\"\{title}\"/><meta name=\"og:title\" content=\"\{title}\"/><meta name=\"description\" content=\"\{description}\"/><meta name=\"twitter:description\" content=\"\{description}\"/><meta name=\"og:description\" content=\"\{description}\"/><meta name=\"twitter:card\" content=\"\{card_type}\"/><link rel=\"stylesheet\" href=\"\{config.stylesheet_path}\" type=\"text/css\"/><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"/><link rel=\"shortcut icon\" href=\"\{favicon}\" type=\"image/png\"/><link rel=\"alternate\" href=\"\{config.feed_path}\" type=\"application/rss+xml\" title=\"Subscribe to \{name}\"/><meta name=\"twitter:image\" content=\"\{social_image}\"/><meta name=\"og:image\" content=\"\{social_image}\"/>\{analytics}</head>"
}

///|
/// Top-level destinations; `current` marks the page the visitor is on.
priv enum NavItem {
  Top
  Articles
  About
  NoCurrent
} derive(Eq)

///|
fn render_header(config : BlogConfig, current : NavItem) -> String {
  let link = fn(item : NavItem, href : String, label : String) {
    let mark = if item == current { " aria-current=\"page\"" } else { "" }
    "<a href=\"\{href}\"\{mark}>\{label}</a>"
  }
  "<header class=\"site-header\"><div class=\"column\"><a class=\"site-name\" href=\"/\">\{escape_html(config.site.name)}</a><nav class=\"site-nav\">\{link(Top, "/", "Top")}\{link(Articles, "/posts/", "Articles")}\{link(About, "/about/", "About")}</nav></div></header>"
}

///|
fn year_span(content : @ssg.PublishedContent) -> String {
  let years = items_by_year(content.all_items()).map(fn(group) { group.0 })
  match (years.last(), years.get(0)) {
    (Some(first), Some(last)) if first != last => "\{first}–\{last}"
    (_, Some(only)) => only
    _ => ""
  }
}

///|
fn render_footer(
  config : BlogConfig,
  content : @ssg.PublishedContent,
) -> String {
  "<footer class=\"site-footer\"><div class=\"column\"><nav class=\"footer-nav\"><a href=\"/\">Top</a><a href=\"/posts/\">Articles</a><a href=\"/about/\">About</a><a href=\"\{config.feed_path}\">RSS</a></nav><p class=\"copyright\">© \{year_span(content)} \{escape_html(config.site.name)}</p></div></footer>"
}

///|
fn render_document(
  config : BlogConfig,
  content : @ssg.PublishedContent,
  path~ : String,
  title~ : String,
  description~ : String,
  body~ : String,
  current~ : NavItem,
  page_class~ : String,
  image_path? : String,
  analytics? : Bool = true,
) -> String {
  "<!DOCTYPE html><html lang=\"\{config.site.language}\">\{render_head(config, path, title, description, image_path, analytics)}<body class=\"\{page_class}\">\{render_header(config, current)}<main class=\"column\">\{body}</main>\{render_footer(config, content)}</body></html>"
}

///|
fn iso_date(item : @ssg.PublishItem) -> String {
  dotted_date(item.content.date).replace_all(old=".", new="-")
}

///|
fn render_time(item : @ssg.PublishItem, label : String) -> String {
  "<time datetime=\"\{iso_date(item)}\">\{label}</time>"
}

///|
fn render_tags(tags : Array[String]) -> String {
  let links = tags.map(fn(tag) {
    "<li><a href=\"/tags/\{tag}\">#\{escape_html(tag)}</a></li>"
  })
  "<ul class=\"tags\">\{links.join("")}</ul>"
}

///|
fn render_label(label : String) -> String {
  "<h2 class=\"section-label\">\{label}</h2>"
}

///|
fn render_section_head(label : String, more : (String, String)?) -> String {
  let link = match more {
    Some((href, text)) => "<a class=\"more\" href=\"\{href}\">\{text}</a>"
    None => ""
  }
  "<div class=\"section-head\">\{render_label(label)}\{link}</div>"
}

///|
/// A post summary used by pinned cards, recent rows and tag pages.
fn render_post_summary(item : @ssg.PublishItem, class : String) -> String {
  "<article class=\"\{class}\">\{render_time(item, dotted_date(item.content.date))}<h3><a href=\"\{item.path()}\">\{escape_html(item.content.title)}</a></h3><p class=\"excerpt\">\{excerpt(item, 88)}</p>\{render_tags(item.tags)}</article>"
}

///|
fn render_post_list(items : Array[@ssg.PublishItem]) -> String {
  let rows = items.map(fn(item) {
    "<li>\{render_post_summary(item, "post-row")}</li>"
  })
  "<ul class=\"post-list\">\{rows.join("")}</ul>"
}

///|
let x_icon : String = "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M18.9 2.9h3.3l-7.2 8.3 8.5 11.9h-6.6l-5.2-7.2-5.9 7.2H2.5l7.7-8.9L2 2.9h6.8l4.7 6.6 5.4-6.6Zm-1.2 18.1h1.8L7.8 4.9H5.9L17.7 21Z\"/></svg>"

///|
let github_icon : String = "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M12 2C6.48 2 2 6.58 2 12.25c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.5 0-.24-.01-1.05-.02-1.9-2.78.62-3.37-1.22-3.37-1.22-.45-1.18-1.1-1.5-1.1-1.5-.9-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.1 2.91.84.09-.66.35-1.1.63-1.36-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05A9.32 9.32 0 0 1 12 6.94c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9 0 1.36-.01 2.46-.01 2.8 0 .28.18.6.69.5A10.2 10.2 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z\"/></svg>"

///|
fn render_social(config : BlogConfig) -> String {
  "<div class=\"social\"><a class=\"icon-link\" href=\"\{config.x_url}\" aria-label=\"X\">\{x_icon}</a><a class=\"icon-link\" href=\"\{config.github_url}\" aria-label=\"GitHub\">\{github_icon}</a></div>"
}

///|
fn metadata_text(content : @ssg.LocationContent, key : String) -> String {
  escape_html(content.metadata.get(key).unwrap_or(""))
}

///|
/// Body of Content/index.md or a page without its leading `# ` heading,
/// which is used for <title> and the page heading instead.
fn home_body(body_html : String) -> String {
  if body_html.has_prefix("<h1>") {
    match body_html.find("</h1>") {
      Some(end) => body_html[end + "</h1>".length():].to_owned()
      None => body_html
    }
  } else {
    body_html
  }
}

///|
fn render_tag_cloud(content : @ssg.PublishedContent) -> String {
  let tags = tag_counts(content).map(fn(entry) {
    "<li><a href=\"/tags/\{entry.0}\">\{escape_html(entry.0)} <span>\{entry.1}</span></a></li>"
  })
  "<ul class=\"tag-cloud\">\{tags.join("")}</ul>"
}

///|
fn render_home(config : BlogConfig, content : @ssg.PublishedContent) -> String {
  let index = content.index
  let profile = "<section class=\"section profile\">\{render_section_head("Profile", Some(("/about/", "詳しく →")))}<p class=\"profile-handle\">\{metadata_text(index, "profile")}</p><div class=\"profile-bio\">\{home_body(index.body_html)}</div>\{render_social(config)}</section>"
  let pinned = match pinned_items(content) {
    [] => ""
    items => {
      let cards = items.map(fn(item) {
        "<li>\{render_post_summary(item, "pinned-card")}</li>"
      })
      "<section class=\"section pinned\">\{render_section_head("Pinned", None)}<ul class=\"pinned-list\">\{cards.join("")}</ul></section>"
    }
  }
  let recent = "<section class=\"section recent\">\{render_section_head("Recent", Some(("/posts/", "すべての記事 →")))}\{render_post_list(recent_items(content, 5))}</section>"
  let rss = "<section class=\"section rss\"><p class=\"rss-text\">\{metadata_text(index, "rss")}</p><a class=\"button\" href=\"\{config.feed_path}\">RSS で購読する</a></section>"
  let tags = "<section class=\"section tags\">\{render_section_head("Tags", None)}\{render_tag_cloud(content)}</section>"
  // The order also serves narrow screens; CSS places profile and rss beside the main column.
  "<div class=\"home-layout\">\{profile}<div class=\"home-main\">\{pinned}\{recent}</div>\{rss}\{tags}</div>"
}

///|
fn render_articles(content : @ssg.PublishedContent) -> String {
  let items = content.all_items()
  let years = items_by_year(items).map(fn(group) {
    let rows = group.1.map(fn(item) {
      "<li>\{render_time(item, dotted_date(item.content.date)[5:].to_owned())}<a href=\"\{item.path()}\">\{escape_html(item.content.title)}</a></li>"
    })
    "<section class=\"year\"><h2 class=\"year-label\">\{group.0}</h2><ul class=\"archive\">\{rows.join("")}</ul></section>"
  })
  "<header class=\"page-header\">\{render_label("Articles")}<h1>すべての記事</h1><p class=\"page-meta\">\{items.length()} posts · \{year_span(content)}</p></header>\{years.join("")}"
}

///|
fn last_path_segment(url : String) -> String {
  url.split("/").to_array().last().map(fn(s) { s.to_owned() }).unwrap_or("")
}

///|
fn render_links(config : BlogConfig) -> String {
  let row = fn(icon : String, label : String, href : String, text : String) {
    "<li><span class=\"link-icon\">\{icon}</span><span class=\"link-label\">\{label}</span><a href=\"\{href}\">\{text}</a></li>"
  }
  "<section class=\"section links\">\{render_section_head("Links", None)}<ul class=\"link-list\">\{row(x_icon, "X", config.x_url, "@" + last_path_segment(config.x_url))}\{row(github_icon, "GitHub", config.github_url, last_path_segment(config.github_url))}\{row("<span class=\"rss-mark\">RSS</span>", "Feed", config.feed_path, "feed.rss")}</ul></section>"
}

///|
/// The blog theme as moonbit-ssg HTML callbacks.
pub fn blog_html_factory(config : BlogConfig) -> @ssg.PublishHTMLFactory {
  {
    make_index: fn(index, content) {
      render_document(
        config,
        content,
        path="/",
        title=index.title,
        description=config.site.description,
        body=render_home(config, content),
        current=Top,
        page_class="page-home",
      )
    },
    make_section: fn(section, content) {
      render_document(
        config,
        content,
        path="/\{section.id}",
        title="Articles",
        description=config.site.description,
        body=render_articles(content),
        current=Articles,
        page_class="page-articles",
      )
    },
    make_item: fn(item, content) {
      let meta = "\{render_time(item, dotted_date(item.content.date))}\{render_tags(item.tags)}"
      render_document(
        config,
        content,
        path=item.path(),
        title=item.content.title,
        description=item.content.description,
        body="<article class=\"article\"><header class=\"article-header\"><div class=\"article-meta\">\{meta}</div><h1>\{escape_html(item.content.title)}</h1></header><div class=\"content\">\{item.content.body_html}</div><footer class=\"article-end\"><a href=\"/posts/\">← 記事一覧へ</a></footer></article>",
        current=Articles,
        page_class="page-post",
        image_path?=item.content.image_path,
        analytics=false,
      )
    },
    make_page: fn(page, content) {
      let is_about = page.path == "about"
      let subtitle = metadata_text(page.content, "subtitle")
      let meta = if subtitle.is_empty() {
        ""
      } else {
        "<p class=\"page-meta\">\{subtitle}</p>"
      }
      let links = if is_about { render_links(config) } else { "" }
      let label = if is_about { "About" } else { "Page" }
      render_document(
        config,
        content,
        path="/\{page.path}",
        title=page.content.title,
        description=page.content.description,
        body="<header class=\"page-header\">\{render_label(label)}<h1>\{escape_html(page.content.title)}</h1>\{meta}</header><div class=\"content page-content\">\{home_body(page.content.body_html)}</div>\{links}",
        current=if is_about { About } else { NoCurrent },
        page_class="page-page",
      )
    },
    make_tag_list: fn(_, content) {
      Some(
        render_document(
          config,
          content,
          path="/tags",
          title="Tags",
          description=config.site.description,
          body="<header class=\"page-header\">\{render_label("Tags")}<h1>タグ</h1></header>\{render_tag_cloud(content)}",
          current=NoCurrent,
          page_class="page-tags",
        ),
      )
    },
    make_tag_details: fn(tag, _, content) {
      let items = content
        .all_items()
        .filter(fn(item) { item.tags.contains(tag) })
      Some(
        render_document(
          config,
          content,
          path="/tags/\{tag}",
          title="#\{tag}",
          description=config.site.description,
          body="<header class=\"page-header\">\{render_label("Tag")}<h1>#\{escape_html(tag)}</h1><p class=\"page-meta\">\{items.length()} posts · <a href=\"/tags/\">すべてのタグ</a></p></header>\{render_post_list(items_by_descending_date(items))}",
          current=NoCurrent,
          page_class="page-tag",
        ),
      )
    },
  }
}
