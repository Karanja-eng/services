"""Repair a markdown file that was double-encoded (UTF-8 read as cp1252, re-saved).

Reverse mapping: for each character, find the cp1252 byte that would decode to it
(undefined cp1252 bytes 0x81/0x8D/0x8F/0x90/0x9D map to U+0081..U+009F), collect the
bytes, then decode the result as UTF-8 — which restores the original text.

Usage: python scripts/fix_double_encoded_md.py <file> [--check]
"""
import sys

REVERSE = {}
for byte in range(256):
    try:
        char = bytes([byte]).decode("cp1252")
    except UnicodeDecodeError:
        char = chr(byte)
    REVERSE[char] = byte


def repair(path: str, check_only: bool = False) -> int:
    with open(path, encoding="utf-8") as handle:
        text = handle.read()
    out = bytearray()
    unknown = 0
    for char in text:
        byte = REVERSE.get(char)
        if byte is None:
            unknown += 1
            out.extend(char.encode("utf-8"))
        else:
            out.append(byte)
    try:
        fixed = out.decode("utf-8")
    except UnicodeDecodeError as exc:
        print(f"{path}: not a simple double-encoding ({exc})")
        return 1

    changed = sum(1 for a, b in zip(text, fixed) if a != b) + abs(len(text) - len(fixed))
    print(f"{path}: characters_changed~{changed}, unmapped={unknown}")
    if check_only:
        return 0 if changed == 0 else 2
    if changed:
        with open(path, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(fixed)
        print(f"{path}: repaired")
    return 0


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    check = "--check" in sys.argv
    if not args:
        print(__doc__)
        raise SystemExit(2)
    raise SystemExit(max(repair(path, check) for path in args))
