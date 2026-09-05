import tempfile
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from compare_site_outputs import compare_outputs


class SiteOutputComparisonTests(unittest.TestCase):
    def test_accepts_identical_file_trees(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            reference = root / "reference"
            candidate = root / "candidate"
            for output in (reference, candidate):
                (output / "posts/example").mkdir(parents=True)
                (output / "posts/example/index.html").write_bytes(b"<h1>Example</h1>")
                (output / "styles.css").write_bytes(b"body {}")

            comparison = compare_outputs(reference, candidate)

        self.assertTrue(comparison.matches)
        self.assertEqual(comparison.matching_files, 2)
        self.assertEqual(comparison.missing_from_candidate, ())
        self.assertEqual(comparison.extra_in_candidate, ())
        self.assertEqual(comparison.changed, ())

    def test_reports_path_and_content_differences(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            reference = root / "reference"
            candidate = root / "candidate"
            reference.mkdir()
            candidate.mkdir()
            (reference / "missing.html").write_bytes(b"reference only")
            (candidate / "extra.html").write_bytes(b"candidate only")
            (reference / "changed.html").write_bytes(b"same-prefix-reference")
            (candidate / "changed.html").write_bytes(b"same-prefix-candidate")
            (reference / "matching.css").write_bytes(b"body {}")
            (candidate / "matching.css").write_bytes(b"body {}")

            comparison = compare_outputs(reference, candidate)

        self.assertFalse(comparison.matches)
        self.assertEqual(comparison.matching_files, 1)
        self.assertEqual(comparison.missing_from_candidate, ("missing.html",))
        self.assertEqual(comparison.extra_in_candidate, ("extra.html",))
        self.assertEqual(len(comparison.changed), 1)
        self.assertEqual(comparison.changed[0].path, "changed.html")
        self.assertEqual(comparison.changed[0].first_difference, len(b"same-prefix-"))
        self.assertNotEqual(comparison.changed[0].reference_sha256, comparison.changed[0].candidate_sha256)

    def test_reports_appended_bytes_as_the_first_difference(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            reference = root / "reference"
            candidate = root / "candidate"
            reference.mkdir()
            candidate.mkdir()
            (reference / "feed.rss").write_bytes(b"feed")
            (candidate / "feed.rss").write_bytes(b"feed-more")

            comparison = compare_outputs(reference, candidate)

        self.assertEqual(comparison.changed[0].first_difference, len(b"feed"))


if __name__ == "__main__":
    unittest.main()
