import tempfile
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from check_output_site import check_output
from replace_local_images_with_gyazo import is_target_local_image
from gyazo_upload_core import has_supported_image_signature


class LocalImageDetectionTests(unittest.TestCase):
    def test_only_drafting_local_images_are_targets(self):
        prefixes = ("attachments/", ".markmesh/blog-assets/")

        self.assertTrue(is_target_local_image("attachments/photo.png", prefixes))
        self.assertTrue(is_target_local_image(".markmesh/blog-assets/photo.png", prefixes))
        self.assertFalse(is_target_local_image("https://i.gyazo.com/photo.png", prefixes))
        self.assertFalse(is_target_local_image("/images/photo.png", prefixes))
        self.assertFalse(is_target_local_image("../outside.png", prefixes))


class ImageSignatureTests(unittest.TestCase):
    def test_detects_supported_image_signatures(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            png = root / "image.png"
            jpg = root / "image.jpg"
            ico_named_png = root / "favicon.png"
            png.write_bytes(b"\x89PNG\r\n\x1a\nrest")
            jpg.write_bytes(b"\xff\xd8\xffrest")
            ico_named_png.write_bytes(b"\x00\x00\x01\x00rest")

            self.assertTrue(has_supported_image_signature(png))
            self.assertTrue(has_supported_image_signature(jpg))
            self.assertFalse(has_supported_image_signature(ico_named_png))


class OutputAssetCheckTests(unittest.TestCase):
    def test_reports_missing_local_assets(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            (output / "posts/example").mkdir(parents=True)
            (output / "posts/example/index.html").write_text(
                '<img src="/images/missing.png"><img src="https://example.com/remote.png">',
                encoding="utf-8",
            )

            errors = check_output(output)

        self.assertEqual(errors, ["posts/example/index.html: missing asset /images/missing.png"])

    def test_accepts_existing_local_assets(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            (output / "images").mkdir()
            (output / "images/logo.png").write_bytes(b"png")
            (output / "index.html").write_text('<img src="/images/logo.png">', encoding="utf-8")

            errors = check_output(output)

        self.assertEqual(errors, [])


if __name__ == "__main__":
    unittest.main()
