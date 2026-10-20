///|
/// Paragraphs shorter than this (e.g. "Short.") are skipped for excerpts.
let min_excerpt_paragraph : Int = 12

///|
fn unescape_html(value : String) -> String {
  value
  .replace_all(old="&lt;", new="<")
  .replace_all(old="&gt;", new=">")
  .replace_all(old="&quot;", new="\"")
  .replace_all(old="&#39;", new="'")
  .replace_all(old="&amp;", new="&")
}

///|
fn strip_tags(html : String) -> String {
  let output = StringBuilder()
  let mut in_tag = false
  for character in html {
    if character == '<' {
      in_tag = true
    } else if character == '>' {
      in_tag = false
    } else if !in_tag {
      output.write_char(character)
    }
  }
  output.to_string()
}

///|
fn truncate(text : String, max : Int) -> String {
  let characters = text.to_array()
  if characters.length() <= max {
    return text
  }
  String::from_array(characters[:max]).trim_end().to_owned() + "…"
}

///|
/// HTML-escaped summary for lists: the description, or the first paragraph.
pub fn excerpt(item : @ssg.PublishItem, max : Int) -> String {
  let description = item.content.description.trim().to_owned()
  if !description.is_empty() {
    return escape_html(truncate(description, max))
  }
  let html = item.content.body_html
  let mut start = 0
  while html[start:].find("<p>") is Some(offset) {
    let open = start + offset + "<p>".length()
    let close = match html[open:].find("</p>") {
      Some(length) => open + length
      None => html.length()
    }
    let text = unescape_html(strip_tags(html[open:close].to_owned()))
      .trim()
      .to_owned()
    if text.to_array().length() >= min_excerpt_paragraph {
      return escape_html(truncate(text, max))
    }
    start = close
  }
  ""
}

///|
/// `2026-05-12 19:10` becomes `2026.05.12`.
pub fn dotted_date(date : String) -> String {
  match date.split(" ").to_array().get(0) {
    Some(day) => day.to_owned().replace_all(old="-", new=".")
    None => ""
  }
}

///|
/// Newest first. Items with the same date keep their filename order.
fn items_by_descending_date(
  items : Array[@ssg.PublishItem],
) -> Array[@ssg.PublishItem] {
  let sorted = items.copy()
  sorted.sort_by(fn(left, right) {
    right.content.date.compare(left.content.date)
  })
  sorted
}

///|
pub fn recent_items(
  content : @ssg.PublishedContent,
  count : Int,
) -> Array[@ssg.PublishItem] {
  let items = items_by_descending_date(content.all_items())
  items[:if items.length() < count { items.length() } else { count }].to_owned()
}

///|
/// Posts marked with `pinned: true` in their frontmatter.
pub fn pinned_items(content : @ssg.PublishedContent) -> Array[@ssg.PublishItem] {
  items_by_descending_date(content.all_items()).filter(fn(item) {
    item.metadata.get("pinned") == Some("true")
  })
}

///|
pub fn items_by_year(
  items : Array[@ssg.PublishItem],
) -> Array[(String, Array[@ssg.PublishItem])] {
  let groups : Array[(String, Array[@ssg.PublishItem])] = []
  for item in items_by_descending_date(items) {
    let year = item.content.date.to_array()[:4]
      .iter()
      .fold(init="", fn(acc, c) { acc + c.to_string() })
    match groups.last() {
      Some((last, posts)) if last == year => posts.push(item)
      _ => groups.push((year, [item]))
    }
  }
  groups
}

///|
/// Orders strings by Unicode scalar values (String::compare does not).
fn compare_code_points(left : String, right : String) -> Int {
  let l = left.to_array()
  let r = right.to_array()
  for index = 0; index < l.length() && index < r.length(); index = index + 1 {
    let order = l[index].compare(r[index])
    if order != 0 {
      return order
    }
  }
  l.length().compare(r.length())
}

///|
pub fn tag_counts(content : @ssg.PublishedContent) -> Array[(String, Int)] {
  let counts : Array[(String, Int)] = []
  for item in content.all_items() {
    for tag in item.tags {
      match counts.search_by(fn(entry) { entry.0 == tag }) {
        Some(index) => counts[index] = (tag, counts[index].1 + 1)
        None => counts.push((tag, 1))
      }
    }
  }
  counts.sort_by(fn(left, right) {
    let by_count = right.1.compare(left.1)
    if by_count != 0 {
      by_count
    } else {
      compare_code_points(left.0, right.0)
    }
  })
  counts
}
