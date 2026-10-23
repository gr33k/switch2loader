#!/usr/bin/env python3
"""Print a read-only SmileBASIC slot-0 source checker and expected values.

The generated BASIC program belongs in slot 1. RUN 1 reads slot 0; it never
executes or edits slot 0. This tool does not send keyboard reports.
"""

import argparse
from pathlib import Path

BASE = 131
MODULUS = 1_000_000_007
MAX_BYTES = 64 * 1024

CHECKER = '''' Read-only slot-0 source checker; run this SLOT 1 only.
VAR N=PRGSIZE(0),C=0,H=0,I,J,S$
IF N<1 OR N>400 THEN PRINT "BAD SIZE",N:END
PRGEDIT 0
FOR I=1 TO N
 S$=PRGGET$()
 C=C+LEN(S$)
 FOR J=0 TO LEN(S$)-1
  H=(H*131+ASC(S$[J])) MOD 1000000007
 NEXT
 H=(H*131+10) MOD 1000000007
NEXT
PRINT "LINES",N,"CHARS",C,"HASH",H
END
'''


def digest(lines: list[str]) -> tuple[int, int, int]:
    value = 0
    count = 0
    for line in lines:
        count += len(line)
        for char in line:
            value = (value * BASE + ord(char)) % MODULUS
        value = (value * BASE + 10) % MODULUS
    return len(lines), count, value


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
    print(CHECKER)
    print("Expected LINES, CHARS, HASH:", *digest(lines))
    if raw.endswith(b"\n"):
        print("If the final Enter made one extra empty editor line:", *digest(lines + [""]))
    print("A matching result verifies the editor text only. It does not make the exploit safe to run.")


if __name__ == "__main__":
    main()
