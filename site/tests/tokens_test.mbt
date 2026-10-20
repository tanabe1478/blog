///|
fn css(source : String) -> String {
  match @site.tokens_css(source) {
    Ok(css) => css
    Err(error) => "error: \{error}"
  }
}

///|
test "base and light tokens go to :root, dark tokens to the dark media query" {
  inspect(
    css(
      (
        #|{
        #|  "base": { "color": { "accent": { "$type": "color", "$value": "#155DFC" } } },
        #|  "light": { "color": { "text": { "$type": "color", "$value": "#101828" } } },
        #|  "dark": { "color": { "text": { "$type": "color", "$value": "#F3F4F6" } } }
        #|}
      ),
    ),
    content=(
      #|:root {
      #|  --color-accent: #155DFC;
      #|  --color-text: #101828;
      #|}
      #|@media (prefers-color-scheme: dark) {
      #|  :root {
      #|    --color-text: #F3F4F6;
      #|  }
      #|}
      #|
    ),
  )
}

///|
test "convert px sizes to rem and keep radius in px" {
  inspect(
    css(
      (
        #|{
        #|  "base": {
        #|    "font": { "size": { "sm": { "$type": "fontSizes", "$value": "14" }, "code": { "$type": "fontSizes", "$value": "13.6" } } },
        #|    "space": { "md": { "$type": "spacing", "$value": "16" } },
        #|    "size": { "content": { "$type": "sizing", "$value": "672" } },
        #|    "radius": { "full": { "$type": "borderRadius", "$value": "999" } },
        #|    "line-height": { "body": { "$type": "number", "$value": "1.7" } }
        #|  },
        #|  "light": {},
        #|  "dark": {}
        #|}
      ),
    ),
    content=(
      #|:root {
      #|  --font-size-sm: 0.875rem;
      #|  --font-size-code: 0.85rem;
      #|  --space-md: 1rem;
      #|  --size-content: 42rem;
      #|  --radius-full: 999px;
      #|  --line-height-body: 1.7;
      #|}
      #|@media (prefers-color-scheme: dark) {
      #|  :root {
      #|  }
      #|}
      #|
    ),
  )
}

///|
test "quote font family names that contain spaces" {
  let output = css(
    (
      #|{
      #|  "base": { "font": { "family": { "sans": { "$type": "fontFamilies", "$value": ["-apple-system", "Segoe UI", "sans-serif"] } } } },
      #|  "light": {},
      #|  "dark": {}
      #|}
    ),
  )
  assert_true(
    output.contains(
      "--font-family-sans: -apple-system, \"Segoe UI\", sans-serif;",
    ),
  )
}

///|
test "expand typography into references and split italic weights" {
  let output = css(
    (
      #|{
      #|  "base": {
      #|    "typography": {
      #|      "date": { "$type": "typography", "$value": { "fontFamilies": "{font.family.sans}", "fontSizes": "{font.size.sm}", "fontWeight": "400 italic", "lineHeight": "{line-height.body}" } },
      #|      "body": { "$type": "typography", "$value": { "fontFamilies": ["Noto Sans JP", "sans-serif"], "fontSizes": "16", "fontWeight": "{font.weight.regular}", "lineHeight": "1.7" } }
      #|    }
      #|  },
      #|  "light": {},
      #|  "dark": {}
      #|}
    ),
  )
  inspect(
    output,
    content=(
      #|:root {
      #|  --typography-date-font-family: var(--font-family-sans);
      #|  --typography-date-font-size: var(--font-size-sm);
      #|  --typography-date-font-weight: 400;
      #|  --typography-date-font-style: italic;
      #|  --typography-date-line-height: var(--line-height-body);
      #|  --typography-body-font-family: "Noto Sans JP", sans-serif;
      #|  --typography-body-font-size: 1rem;
      #|  --typography-body-font-weight: var(--font-weight-regular);
      #|  --typography-body-font-style: normal;
      #|  --typography-body-line-height: 1.7;
      #|}
      #|@media (prefers-color-scheme: dark) {
      #|  :root {
      #|  }
      #|}
      #|
    ),
  )
}

///|
test "report invalid token files" {
  assert_true(css("{").has_prefix("error: "))
  assert_true(
    css("{ \"light\": {}, \"dark\": {} }").contains("missing token set: base"),
  )
}
