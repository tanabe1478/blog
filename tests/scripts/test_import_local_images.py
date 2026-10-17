import hashlib
import tempfile
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from import_local_images import (
    has_supported_image_signature,
    import_images,
    is_target_local_image,
)

PNG = b"\x89PNG\r\n\x1a\nrest"
PREFIXES = ("attachments/", ".markmesh/blog-assets/")


class LocalImageDetectionTests(unittest.TestCase):
    def test_only_drafting_local_images_are_targets(self):
        self.assertTrue(is_target_local_image("attachments/photo.png", PREFIXES))
        self.assertTrue(is_target_local_image(".markmesh/blog-assets/photo.png", PREFIXES))
        self.assertFalse(is_target_local_image("https://example.com/photo.png", PREFIXES))
        self.assertFalse(is_target_local_image("/images/photo.png", PREFIXES))
        self.assertFalse(is_target_local_image("../outside.png", PREFIXES))


class ImageSignatureTests(unittest.TestCase):
    def test_detects_supported_image_signatures(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            png = root / "image.png"
            jpg = root / "image.jpg"
            ico_named_png = root / "favicon.png"
            png.write_bytes(PNG)
            jpg.write_bytes(b"\xff\xd8\xffrest")
            ico_named_png.write_bytes(b"\x00\x00\x01\x00rest")

            self.assertTrue(has_supported_image_signature(png))
            self.assertTrue(has_supported_image_signature(jpg))
            self.assertFalse(has_supported_image_signature(ico_named_png))


class ImportImagesTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.posts = self.root / "Content/posts"
        self.resources = self.root / "Resources/images"
        (self.posts / "attachments").mkdir(parents=True)
        self.digest = hashlib.sha256(PNG).hexdigest()[:16]

    def tearDown(self):
        self.directory.cleanup()

    def write_post(self, body: str) -> Path:
        post = self.posts / "my-post.md"
        post.write_text(body, encoding="utf-8")
        return post

    def test_copies_image_into_resources_and_rewrites_markdown(self):
        (self.posts / "attachments/desk.PNG").write_bytes(PNG)
        post = self.write_post("before\n![desk](attachments/desk.PNG)\n![](/images/keep.png)\n")

        count = import_images(post, PREFIXES, dry_run=False, images_dir=self.resources)

        self.assertEqual(count, 1)
        self.assertEqual((self.resources / f"my-post/{self.digest}.png").read_bytes(), PNG)
        self.assertEqual(
            post.read_text(encoding="utf-8"),
            f"before\n![desk](/images/my-post/{self.digest}.png)\n![](/images/keep.png)\n",
        )

    def test_preserves_mixed_line_endings(self):
        (self.posts / "attachments/desk.png").write_bytes(PNG)
        post = self.posts / "my-post.md"
        post.write_bytes(b"crlf line\r\n![desk](attachments/desk.png)\r\nlf line\n")

        import_images(post, PREFIXES, dry_run=False, images_dir=self.resources)

        self.assertEqual(
            post.read_bytes(),
            f"crlf line\r\n![desk](/images/my-post/{self.digest}.png)\r\nlf line\n".encode(),
        )

    def test_dry_run_does_not_write(self):
        (self.posts / "attachments/desk.png").write_bytes(PNG)
        post = self.write_post("![desk](attachments/desk.png)\n")

        count = import_images(post, PREFIXES, dry_run=True, images_dir=self.resources)

        self.assertEqual(count, 1)
        self.assertFalse(self.resources.exists())
        self.assertEqual(post.read_text(encoding="utf-8"), "![desk](attachments/desk.png)\n")

    def test_rejects_files_that_are_not_images(self):
        (self.posts / "attachments/fake.png").write_bytes(b"not an image")
        post = self.write_post("![fake](attachments/fake.png)\n")

        with self.assertRaises(ValueError):
            import_images(post, PREFIXES, dry_run=False, images_dir=self.resources)
        self.assertEqual(post.read_text(encoding="utf-8"), "![fake](attachments/fake.png)\n")

    def test_missing_image_is_an_error(self):
        post = self.write_post("![gone](attachments/gone.png)\n")

        with self.assertRaises(FileNotFoundError):
            import_images(post, PREFIXES, dry_run=False, images_dir=self.resources)


if __name__ == "__main__":
    unittest.main()
