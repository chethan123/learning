#!/usr/bin/env python3
# Run with the existing environment (Pillow 13.0.0 is already installed):
# VENV=/tmp/claude-1001/-home-ubuntu--t3-worktrees-learning-t3-ef9b52f1/9ce183c5-8274-4dbe-8bfe-63f884f14b34/scratchpad/kokoro-test/venv
# "$VENV/bin/python" scripts/word-builder/optimize-pictures.py <rawDir> <outDir> [--force]
# If Pillow is missing: uv pip install --python "$VENV/bin/python" Pillow
"""Flatten and resize generated illustrations to 640px square WebP files."""

import argparse
from pathlib import Path

from PIL import Image, ImageOps


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("rawDir", type=Path)
    parser.add_argument("outDir", type=Path)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    if not args.rawDir.is_dir():
        parser.error(f"Not an input directory: {args.rawDir}")
    args.outDir.mkdir(parents=True, exist_ok=True)
    written = skipped = failed = 0
    for source in sorted(args.rawDir.iterdir()):
        if not source.is_file() or source.suffix.lower() not in {".png", ".jpg", ".jpeg"}:
            continue
        target = args.outDir / f"{source.stem}.webp"
        if target.exists() and not args.force:
            print(f"SKIP {source.name} -> {target.name} (already exists)")
            skipped += 1
            continue
        try:
            with Image.open(source) as original:
                oriented = ImageOps.exif_transpose(original).convert("RGBA")
                white = Image.new("RGBA", oriented.size, "white")
                white.alpha_composite(oriented)
                flattened = white.convert("RGB")
                side = max(flattened.size)
                square = Image.new("RGB", (side, side), "white")
                square.paste(
                    flattened,
                    ((side - flattened.width) // 2, (side - flattened.height) // 2),
                )
                resized = square.resize((640, 640), Image.Resampling.LANCZOS)
                resized.save(target, format="WEBP", quality=82)
            print(f"WRITE {source.name} -> {target.name} ({target.stat().st_size} bytes)")
            written += 1
        except (OSError, ValueError) as error:
            print(f"ERROR {source.name}: {error}")
            failed += 1
    print(f"Summary: {written} written, {skipped} skipped, {failed} failed")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
