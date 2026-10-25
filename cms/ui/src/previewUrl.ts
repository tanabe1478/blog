// URL mapping shared by the read-only article view and the inline editor.
//
// /images/... lives in Resources/images on the main branch. Reading it from
// raw.githubusercontent.com shows images that the CMS uploaded before the blog
// deployment finished. Other root-relative paths point at GitHub Pages.
export function previewImageUrl(src: string): string {
  if (src.startsWith("/images/")) {
    return `https://raw.githubusercontent.com/tanabe1478/blog/main/Resources${src}`;
  }
  return src.startsWith("/") ? `https://tanabe1478.github.io${src}` : src;
}
