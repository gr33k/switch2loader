import unittest

from smilebasic_source_check import digest


class SourceCheckTest(unittest.TestCase):
    def test_known_ascii_lines(self):
        # Independently calculated for the byte sequence AB\nC\n.
        self.assertEqual(digest(["AB", "C"]), (2, 3, 291_049_135))

    def test_trailing_blank_line_changes_hash_and_line_count(self):
        self.assertEqual(digest(["AB", "C", ""]), (3, 3, 127_436_429))


if __name__ == "__main__":
    unittest.main()
