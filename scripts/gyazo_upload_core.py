from __future__ import annotations

import json
import mimetypes
from pathlib import Path
import urllib.error
import urllib.request
import uuid

UPLOAD_URL = "https://upload.gyazo.com/api/upload"
SUPPORTED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}


def has_supported_image_signature(path: Path) -> bool:
    header = path.read_bytes()[:16]
    return (
        header.startswith(b"\x89PNG\r\n\x1a\n")
        or header.startswith(b"\xff\xd8\xff")
        or header.startswith(b"GIF87a")
        or header.startswith(b"GIF89a")
        or (header.startswith(b"RIFF") and header[8:12] == b"WEBP")
    )


def build_multipart_body(path: Path) -> tuple[bytes, str]:
    boundary = f"----tanabe-blog-{uuid.uuid4().hex}"
    content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    image = path.read_bytes()

    parts: list[bytes] = []
    parts.append(
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="imagedata"; filename="{path.name}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n".encode()
    )
    parts.append(image)
    parts.append(f"\r\n--{boundary}--\r\n".encode())
    return b"".join(parts), boundary


def upload(path: Path, token: str) -> dict:
    body, boundary = build_multipart_body(path)
    request = urllib.request.Request(
        UPLOAD_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": "tanabe1478-blog-gyazo-upload",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        message = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Gyazo upload failed: HTTP {error.code}: {message}") from error


def markdown_for(result: dict, alt: str, linked: bool) -> str:
    image_url = result.get("url")
    permalink_url = result.get("permalink_url") or image_url
    if not image_url:
        raise RuntimeError(f"Gyazo response did not include url: {result}")
    if linked:
        return f"[![{alt}]({image_url})]({permalink_url})"
    return f"![{alt}]({image_url})"
