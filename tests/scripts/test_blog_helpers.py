import tempfile
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from check_output_site import check_output


class MoonBitSSGRevisionTests(unittest.TestCase):
    def test_workflows_use_the_repository_revision(self):
        revision = (ROOT / ".moonbit-ssg-revision").read_text(encoding="utf-8").strip()

        self.assertRegex(revision, r"^[0-9a-f]{40}$")
        for relative_path in (
            ".github/workflows/check.yml",
            ".github/workflows/deploy-blog.yml",
        ):
            workflow = (ROOT / relative_path).read_text(encoding="utf-8")
            self.assertIn(f"ref: {revision}", workflow)


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
