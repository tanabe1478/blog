///|
/// Token types authored in px (as Penpot requires) and published in rem, so
/// browser font-size settings keep scaling text and layout.
let rem_types : Array[String] = ["fontSizes", "spacing", "sizing", "dimension"]

///|
let px_types : Array[String] = ["borderRadius", "borderWidth", "letterSpacing"]

///|
fn format_number(value : Double) -> String {
  ((value * 10000.0).round() / 10000.0).to_string()
}

///|
fn token_name(path : Array[String]) -> String {
  "--" + path.join("-")
}

///|
/// `{font.size.sm}` becomes `var(--font-size-sm)`.
fn reference(value : String) -> String? {
  if value.has_prefix("{") && value.has_suffix("}") {
    let inner = value[1:value.length() - 1].to_owned()
    Some(
      "var(\{token_name(inner.split(".").map(fn(s) { s.to_owned() }).collect())})",
    )
  } else {
    None
  }
}

///|
fn scalar_text(value : Json) -> String raise Failure {
  match value {
    String(text) => text
    Number(number, ..) => format_number(number)
    _ => fail("unsupported token value: \{value.stringify()}")
  }
}

///|
fn dimension(value : Json, token_type : String) -> String raise Failure {
  let text = scalar_text(value)
  match reference(text) {
    Some(css) => return css
    None => ()
  }
  let number = @string.parse_double(text) catch { _ => return text }
  if rem_types.contains(token_type) {
    "\{format_number(number / 16.0)}rem"
  } else if px_types.contains(token_type) {
    "\{format_number(number)}px"
  } else {
    format_number(number)
  }
}

///|
fn font_families(value : Json) -> String raise Failure {
  match value {
    Array(names) =>
      names
      .map(name => {
        let name = scalar_text(name)
        if name.contains(" ") {
          "\"\{name}\""
        } else {
          name
        }
      })
      .join(", ")
    _ => {
      let text = scalar_text(value)
      reference(text).unwrap_or(text)
    }
  }
}

///|
/// Expands a typography token into one variable per CSS property.
fn typography(
  path : Array[String],
  value : Json,
  output : Array[(String, String)],
) -> Unit raise Failure {
  let fields = match value {
    Object(fields) => fields
    _ => fail("typography token must be an object: \{path.join(".")}")
  }
  let field = fn(name : String) -> Json raise Failure {
    match fields.get(name) {
      Some(value) => value
      None => fail("typography token \{path.join(".")} is missing \{name}")
    }
  }
  let weight = scalar_text(field("fontWeight"))
  let (weight, style) = match reference(weight) {
    Some(css) => (css, "normal")
    None =>
      if weight.has_suffix(" italic") {
        (weight[:weight.length() - " italic".length()].to_owned(), "italic")
      } else {
        (weight, "normal")
      }
  }
  let name = fn(property : String) { token_name(path) + "-" + property }
  output.push((name("font-family"), font_families(field("fontFamilies"))))
  output.push((name("font-size"), dimension(field("fontSizes"), "fontSizes")))
  output.push((name("font-weight"), weight))
  output.push((name("font-style"), style))
  output.push((name("line-height"), dimension(field("lineHeight"), "number")))
  match fields.get("letterSpacing") {
    Some(value) =>
      output.push((name("letter-spacing"), dimension(value, "letterSpacing")))
    None => ()
  }
}

///|
fn collect_tokens(
  path : Array[String],
  group : Json,
  output : Array[(String, String)],
) -> Unit raise Failure {
  let entries = match group {
    Object(entries) => entries
    _ => fail("token group must be an object: \{path.join(".")}")
  }
  match (entries.get("$type"), entries.get("$value")) {
    (Some(String(token_type)), Some(value)) => {
      match token_type {
        "typography" => typography(path, value, output)
        "fontFamilies" => output.push((token_name(path), font_families(value)))
        "color" | "fontWeights" => {
          let text = scalar_text(value)
          output.push((token_name(path), reference(text).unwrap_or(text)))
        }
        _ => output.push((token_name(path), dimension(value, token_type)))
      }
      return
    }
    _ => ()
  }
  for key, child in entries {
    if !key.has_prefix("$") {
      collect_tokens([..path, key], child, output)
    }
  }
}

///|
fn set_tokens(
  sets : Map[String, Json],
  name : String,
) -> Array[(String, String)] raise Failure {
  let output = []
  match sets.get(name) {
    Some(set) => collect_tokens([], set, output)
    None => fail("missing token set: \{name}")
  }
  output
}

///|
/// Converts design/tokens.json to CSS custom properties. The `base` and
/// `light` sets form the default theme; `dark` applies under
/// `prefers-color-scheme: dark`.
pub fn tokens_css(source : String) -> Result[String, String] {
  try {
    let sets = match @json.parse(source) {
      Object(sets) => sets
      _ => fail("token file must be an object of token sets")
    }
    let base = set_tokens(sets, "base")
    let light = set_tokens(sets, "light")
    let dark = set_tokens(sets, "dark")
    let css = StringBuilder()
    css.write_string(":root {\n")
    for pair in [..base, ..light] {
      css.write_string("  \{pair.0}: \{pair.1};\n")
    }
    css.write_string("}\n@media (prefers-color-scheme: dark) {\n  :root {\n")
    for pair in dark {
      css.write_string("    \{pair.0}: \{pair.1};\n")
    }
    css.write_string("  }\n}\n")
    Ok(css.to_string())
  } catch {
    Failure(message) => Err(message)
    error => Err(error.to_string())
  }
}
