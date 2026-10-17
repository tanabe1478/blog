import { putRepositoryImage } from "./github";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export interface StoredImage {
  imageUrl: string;
  markdown: string;
}

export class InvalidImageError extends Error {}
export class InvalidImagePostError extends Error {}

function detectedImageType(bytes: Uint8Array): string | undefined {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  const header = new TextDecoder("ascii").decode(bytes.subarray(0, 12));
  if (header.startsWith("GIF87a") || header.startsWith("GIF89a")) {
    return "image/gif";
  }
  if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") {
    return "image/webp";
  }
  return undefined;
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

function markdownAlt(name: string): string {
  return name
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.[^.]+$/, "")
    .replace(/[\[\]\r\n\u0000-\u001f\u007f]/g, " ")
    .trim() || "image";
}

// The slug becomes a repository directory, so only allow a single safe path segment.
export function imageSlugFromPostName(postName: string): string | undefined {
  const match = postName.match(/^([A-Za-z0-9][A-Za-z0-9_-]*)\.md$/);
  return match && match[1].length <= 100 ? match[1] : undefined;
}

async function contentDigest(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

// Images are committed to Resources/images/<slug>/ and served by GitHub Pages.
// Content-hash filenames make repeated uploads of the same image idempotent.
export async function storeImageInRepository(
  image: File,
  postName: string,
  token: string,
  request: typeof fetch = fetch,
): Promise<StoredImage> {
  const slug = imageSlugFromPostName(postName);
  if (!slug) {
    throw new InvalidImagePostError("Post name is invalid");
  }
  if (image.size === 0 || image.size > MAX_IMAGE_BYTES) {
    throw new InvalidImageError("Image size is invalid");
  }

  const bytes = new Uint8Array(await image.arrayBuffer());
  const mediaType = detectedImageType(bytes);
  if (!mediaType) {
    throw new InvalidImageError("Image signature is not supported");
  }

  const filename = `${await contentDigest(bytes)}${IMAGE_EXTENSIONS[mediaType]}`;
  await putRepositoryImage(
    `Resources/images/${slug}/${filename}`,
    bytes,
    `image: add ${slug}/${filename} via CMS`,
    token,
    request,
  );

  const imageUrl = `/images/${slug}/${filename}`;
  return {
    imageUrl,
    markdown: `![${markdownAlt(image.name)}](${imageUrl})`,
  };
}
