import tempfile
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from verify_moonbit_ssg import reference_build_date


class ReferenceBuildDateTests(unittest.TestCase):
    def test_converts_publish_rss_date_to_moonbit_argument(self):
        with tempfile.TemporaryDirectory() as directory:
            feed = Path(directory) / "feed.rss"
            feed.write_text(
                "<rss><lastBuildDate>Sat, 5 Sep 2026 13:44:37 +0900</lastBuildDate></rss>",
                encoding="utf-8",
            )

            self.assertEqual(reference_build_date(feed), "2026-09-05T13:44:37+0900")

    def test_rejects_feed_without_build_date(self):
        with tempfile.TemporaryDirectory() as directory:
            feed = Path(directory) / "feed.rss"
            feed.write_text("<rss></rss>", encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "lastBuildDate not found"):
                reference_build_date(feed)


if __name__ == "__main__":
    unittest.main()
