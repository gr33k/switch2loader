#!/usr/bin/env python3
"""Print a read-only SmileBASIC slot-0 source checker and expected values.

The generated BASIC program belongs in slot 1. RUN 1 reads slot 0; it never
executes or edits slot 0. This tool does not send keyboard reports.
"""

import argparse
from pathlib import Path

HASHES = ((31, 1_000_003), (37, 1_000_033))
MAX_BYTES = 64 * 1024

CHECKER_PATH = Path(__file__).with_name("smilebasic_source_checker.bas")


def digest(lines: list[str]) -> tuple[int, int, int, int]:
    """Model PRGGET$(), which includes an LF in each returned editor line.

    The on-console checker also adds an LF marker after each returned line.
    This was confirmed by the physical three-line fixture on 2026-10-23.
    """
    values = [0, 0]
    count = 0
    for line in lines:
        returned = line + "\n"
        count += len(returned)
        for char in returned + "\n":
            code = ord(char)
            for index, (base, modulus) in enumerate(HASHES):
                values[index] = (values[index] * base + code) % modulus
    return len(lines), count, *values


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="ASCII source file to check")
    args = parser.parse_args()
    with args.source.open("rb") as source_file:
        raw = source_file.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES or any(byte > 0x7F for byte in raw) or b"\r" in raw:
        parser.error("Source must be at most 64 KiB, ASCII, and LF-only")
    source = raw.decode("ascii")
    lines = source.split("\n")
    if lines[-1] == "":
        lines.pop()
    if not lines or len(lines) > 400:
        parser.error("Source must contain 1 to 400 lines")

    print("Paste this checker into SmileBASIC slot 1, then RUN 1 from Direct mode:")
    print(CHECKER_PATH.read_text(encoding="ascii"))
    print("Expected LINES, CHARS, H1, H2:", *digest(lines))
    if raw.endswith(b"\n"):
        print("If the final Enter made one extra empty editor line:", *digest(lines + [""]))
    print("A matching result verifies the editor text only. It does not make the exploit safe to run.")


if __name__ == "__main__":
    main()
