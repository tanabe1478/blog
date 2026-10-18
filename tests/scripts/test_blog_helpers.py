import tempfile
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from check_output_site import check_output


class SiteGeneratorSetupTests(unittest.TestCase):
    """The site is built by site/ with moonbit-ssg pinned as a submodule."""

    WORKFLOWS = (".github/workflows/check.yml", ".github/workflows/deploy-blog.yml")

    def test_workflows_check_out_the_pinned_submodule(self):
        for relative_path in self.WORKFLOWS:
            workflow = (ROOT / relative_path).read_text(encoding="utf-8")
            self.assertIn("submodules: true", workflow, relative_path)
            self.assertNotIn("repository: tanabe1478/moonbit-ssg", workflow, relative_path)

    def test_build_uses_the_workspace_generator(self):
        script = (ROOT / "scripts/build_site.sh").read_text(encoding="utf-8")
        self.assertIn("moon run site/cmd/build", script)
        self.assertNotIn("MOONBIT_SSG_DIR", script)
        self.assertIn('"./vendor/moonbit-ssg"', (ROOT / "moon.work").read_text(encoding="utf-8"))

    def test_no_separate_revision_file(self):
        self.assertFalse((ROOT / ".moonbit-ssg-revision").exists())


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
