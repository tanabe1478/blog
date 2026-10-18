///|
/// Site-wide values for tanabe1478.github.io. Values shared with moonbit-ssg's
/// generic feeds live in `site`; the rest are only used by this blog's theme.
pub(all) struct BlogConfig {
  site : @ssg.PublishSiteConfig
  stylesheet_path : String
  feed_path : String
  analytics_id : String
  x_url : String
  github_url : String
} derive(Eq, Debug)

///|
pub fn blog_config() -> BlogConfig {
  {
    site: {
      url: "https://tanabe1478.github.io",
      name: "tanabe1478",
      description: "t__nabe1478のブログです。務め先のブログには書く程でないプログラミングに関することや私事について書きます。",
      language: "en",
      image_path: Some("/images/logo.png"),
      favicon_path: Some("/images/favicon.png"),
    },
    stylesheet_path: "/styles.css",
    feed_path: "/feed.rss",
    analytics_id: "G-Q9KK5M4YNY",
    x_url: "https://x.com/t__nabe1478",
    github_url: "https://github.com/tanabe1478",
  }
}
