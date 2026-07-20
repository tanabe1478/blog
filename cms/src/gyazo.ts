const GYAZO_UPLOAD_URL = "https://upload.gyazo.com/api/upload";
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export interface GyazoImage {
  imageUrl: string;
  permalinkUrl: string;
  markdown: string;
}

export class InvalidImageError extends Error {}

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

function safeFilename(name: string, mediaType: string): string {
  const extension = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
  }[mediaType];
  const basename = name
    .split(/[\\/]/)
    .pop()
    ?.replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, 180);
  return basename || `upload${extension}`;
}

function markdownAlt(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[\[\]\r\n]/g, " ")
    .trim() || "image";
}

function validatedUrl(value: unknown, host: string): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === host ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export async function uploadToGyazo(
  image: File,
  token: string,
  request: typeof fetch = fetch,
): Promise<GyazoImage> {
  if (image.size === 0 || image.size > MAX_IMAGE_BYTES) {
    throw new InvalidImageError("Image size is invalid");
  }

  const bytes = new Uint8Array(await image.arrayBuffer());
  const mediaType = detectedImageType(bytes);
  if (!mediaType) {
    throw new InvalidImageError("Image signature is not supported");
  }

  const filename = safeFilename(image.name, mediaType);
  const form = new FormData();
  form.append("imagedata", new File([bytes], filename, { type: mediaType }));

  const response = await request(GYAZO_UPLOAD_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "user-agent": "tanabe-blog-cms",
    },
    body: form,
  });
  if (!response.ok) {
    throw new Error(`Gyazo API returned ${response.status}`);
  }

  const result: unknown = await response.json();
  if (typeof result !== "object" || result === null) {
    throw new Error("Gyazo API returned an unexpected response");
  }
  const imageUrl = validatedUrl("url" in result ? result.url : undefined, "i.gyazo.com");
  const permalinkUrl = validatedUrl(
    "permalink_url" in result ? result.permalink_url : undefined,
    "gyazo.com",
  );
  if (!imageUrl || !permalinkUrl) {
    throw new Error("Gyazo API returned invalid URLs");
  }

  return {
    imageUrl,
    permalinkUrl,
    markdown: `[![${markdownAlt(filename)}](${imageUrl})](${permalinkUrl})`,
  };
}
