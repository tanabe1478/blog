///|
fn escape_html(value : String) -> String {
  value
  .replace_all(old="&", new="&amp;")
  .replace_all(old="<", new="&lt;")
  .replace_all(old=">", new="&gt;")
}

///|
fn is_url_path_byte(byte : Int) -> Bool {
  (byte >= 0x41 && byte <= 0x5a) ||
  (byte >= 0x61 && byte <= 0x7a) ||
  (byte >= 0x30 && byte <= 0x39) ||
  byte == 0x2f ||
  byte == 0x2d ||
  byte == 0x2e ||
  byte == 0x5f ||
  byte == 0x7e
}

///|
fn percent_encoded_path(path : String) -> String {
  let hex = "0123456789ABCDEF".to_array()
  let output = StringBuilder()
  for byte in @utf8.encode(path) {
    let value = byte.to_int()
    if is_url_path_byte(value) {
      output.write_char(byte.to_char())
    } else {
      output.write_char('%')
      output.write_char(hex[value / 16])
      output.write_char(hex[value % 16])
    }
  }
  output.to_string()
}

///|
/// Absolute URL used by canonical links and social metadata.
fn absolute_url(config : BlogConfig, path : String) -> String {
  let base = config.site.url
  if path.is_empty() || path == "/" {
    base
  } else if path.has_prefix("/") {
    "\{base}\{percent_encoded_path(path)}"
  } else {
    "\{base}/\{percent_encoded_path(path)}"
  }
}
