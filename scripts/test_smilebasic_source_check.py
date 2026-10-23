import unittest

from smilebasic_source_check import digest


class SourceCheckTest(unittest.TestCase):
    def test_known_ascii_lines(self):
        # PRGGET$ returns AB\n and C\n; checker adds another LF per line.
        self.assertEqual(digest(["AB", "C"]), (2, 5, 682_300, 603_044))

    def test_trailing_blank_line_changes_hash_and_line_count(self):
        self.assertEqual(digest(["AB", "C", ""]), (3, 6, 688_655, 540_391))

    def test_physical_probe_readback(self):
        self.assertEqual(
            digest(["' CHECK 012345", "' \"A+B\" []", "' LAST", ""]),
            (4, 34, 633_916, 754_618),
        )


if __name__ == "__main__":
    unittest.main()
