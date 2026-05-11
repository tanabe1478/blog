#!/usr/bin/env python3
"""Check that the public blog URLs and important image assets are reachable."""

from __future__ import annotations

import re
import sys
import urllib.error
import urllib.request

BASE_URL = "https://tanabe1478.github.io"
PAGES = [
    "/",
    "/posts/",
    "/posts/diary-34/",
    "/posts/20200110/",
    "/diary/",
    "/diary/articles/34",
]


def fetch(path_or_url: str) -> tuple[int, str, bytes]:
    url = path_or_url if path_or_url.startswith("http") else BASE_URL + path_or_url
    request = urllib.request.Request(url, headers={"User-Agent": "tanabe1478-blog-check"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.status, response.headers.get("content-type", ""), response.read()


def check_page(path: str) -> list[str]:
    errors: list[str] = []
    try:
        status, content_type, body = fetch(path)
    except urllib.error.HTTPError as error:
        return [f"{path}: HTTP {error.code}"]
    except Exception as error:  # noqa: BLE001 - command-line diagnostics should keep going
        return [f"{path}: {error}"]

    if status != 200:
        errors.append(f"{path}: expected 200, got {status}")
    if "text/html" not in content_type:
        errors.append(f"{path}: expected HTML, got {content_type}")

    html = body.decode("utf-8", errors="replace")
    for src in re.findall(r'<img[^>]+src="([^"]+)"', html):
        if not src.startswith("/"):
            continue
        try:
            image_status, image_content_type, _ = fetch(src)
        except Exception as error:  # noqa: BLE001
            errors.append(f"{path}: image {src} failed: {error}")
            continue
        if image_status != 200:
            errors.append(f"{path}: image {src} expected 200, got {image_status}")
        if not image_content_type.startswith("image/"):
            errors.append(f"{path}: image {src} expected image/*, got {image_content_type}")

    if path.startswith("/diary") and "http-equiv=\"refresh\"" not in html:
        errors.append(f"{path}: expected diary redirect page")

    return errors


def main() -> int:
    all_errors: list[str] = []
    for page in PAGES:
        errors = check_page(page)
        if errors:
            all_errors.extend(errors)
            print(f"FAIL {page}")
        else:
            print(f"OK   {page}")

    if all_errors:
        print("\nErrors:")
        for error in all_errors:
            print(f"- {error}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
