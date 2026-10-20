///|
/// Content folders that become sections. Everything else under Content/ is a page.
let section_ids : Array[String] = ["posts"]

///|
/// Theme stylesheets in Resources/. `/styles.css` is the generated token
/// variables followed by these files, so pages load a single stylesheet.
let theme_stylesheets : Array[String] = [
  "MyHtmlTheme/fonts.css", "MyHtmlTheme/styles.css",
]

///|
fn join_path(parent : String, child : String) -> String {
  if parent.has_suffix("/") {
    "\{parent}\{child}"
  } else {
    "\{parent}/\{child}"
  }
}

///|
fn remove_tree(path : String) -> Unit raise @fs.IOError {
  if !@fs.path_exists(path) {
    return
  }
  if @fs.is_dir(path) {
    for name in @fs.read_dir(path) {
      remove_tree(join_path(path, name))
    }
    @fs.remove_dir(path)
  } else {
    @fs.remove_file(path)
  }
}

///|
/// Current time in JST, used for RSS `lastBuildDate` and sitemap `lastmod`.
pub fn current_build_date() -> @ssg.BuildDate {
  let zone = @time.fixed_zone("JST", 9 * 60 * 60) catch {
    _ => abort("unable to construct JST timezone")
  }
  let unix_seconds = (@env.now() / 1000UL).reinterpret_as_int64()
  let date = @time.unix(unix_seconds, zone~) catch {
    _ => abort("unable to read current date")
  }
  {
    year: date.year(),
    month: date.month(),
    day: date.day(),
    hour: date.hour(),
    minute: date.minute(),
    second: date.second(),
    utc_offset: "+0900",
  }
}

///|
/// Generates the whole site into a clean `output_directory`.
pub fn build_site(
  config : BlogConfig,
  content_directory : String,
  resources_directory : String,
  tokens_path : String,
  output_directory : String,
  build_date~ : @ssg.BuildDate,
) -> Unit raise @fs.IOError {
  let tokens = match tokens_css(@fs.read_file_to_string(tokens_path)) {
    Ok(css) => css
    Err(message) => raise @fs.IOError("invalid design tokens: \{message}")
  }
  let content = @ssg.load_published_content(content_directory, section_ids)
  remove_tree(output_directory)
  @ssg.generate_publish_html(
    output_directory,
    content,
    blog_html_factory(config),
    tag_base_path="tags",
  )
  @fs.write_string_to_file(
    join_path(output_directory, "feed.rss"),
    @ssg.render_publish_rss_feed(config.site, content, section_ids, build_date),
  )
  @fs.write_string_to_file(
    join_path(output_directory, "sitemap.xml"),
    @ssg.render_publish_sitemap(config.site, content, build_date),
  )
  @ssg.copy_publish_files(resources_directory, output_directory)
  let stylesheet = StringBuilder()
  stylesheet.write_string(tokens)
  for path in theme_stylesheets {
    stylesheet.write_string("\n")
    stylesheet.write_string(
      @fs.read_file_to_string(join_path(resources_directory, path)),
    )
  }
  @fs.write_string_to_file(
    join_path(output_directory, "styles.css"),
    stylesheet.to_string(),
  )
}
