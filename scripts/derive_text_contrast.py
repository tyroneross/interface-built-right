#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Derive a text colour that clears a contrast floor, instead of picking one.

WHY THIS EXISTS
---------------
"Use #8b8ba6 for muted text" is a style opinion wearing a measurement's clothes.
It passes designs that happen to match its author's taste and fails ones that are
equally valid in another visual language. This script emits the other kind of
answer: a value that is a FUNCTION of the token you have, the surfaces it
actually composites against, and the threshold its role requires.

Change the palette and rerun it; the recommendation moves with the data. That is
the property a constant does not have.

WHAT IS HELD AND WHAT MOVES
---------------------------
Hue and saturation are held EXACTLY. Only lightness moves, and only as far as the
floor requires. Contrast is a relationship between two luminances, and lightness
is the one dimension that relationship actually constrains — so moving hue or
saturation would be changing the design to satisfy a measurement that never asked.
The muted grey-violet stays a muted grey-violet; it just becomes readable.

HEADROOM IS PART OF THE ANSWER
------------------------------
Solving to exactly 4.50:1 is not a fix, it is a coin balanced on its edge: the
next surface tweak silently reopens the defect. `--headroom` (default 0.8) is
carried above the floor so the result survives ordinary edits. Report both, so a
reader can see the floor and the margin separately.

USAGE
    python3 scripts/derive_text_contrast.py --token '#5a5a72' \
        --base '#060611' \
        --overlay 'rgba(255,255,255,0.025)' \
        --overlay 'rgba(129,140,248,0.12)'

    # AAA instead of AA, and a wider margin
    python3 scripts/derive_text_contrast.py --token '#5a5a72' --base '#060611' \
        --floor 7.0 --headroom 1.0

Stdlib only. No network.
"""
from __future__ import annotations

import argparse
import colorsys
import re
import sys

__version__ = "1.0.0"


# ---------------------------------------------------------------------------
# Colour primitives (WCAG 2.1 relative luminance)
# ---------------------------------------------------------------------------

def hex_to_rgb(value: str) -> tuple[float, float, float]:
    v = value.strip().lstrip("#")
    if len(v) == 3:
        v = "".join(c * 2 for c in v)
    if len(v) != 6 or not re.fullmatch(r"[0-9a-fA-F]{6}", v):
        raise ValueError(f"not a hex colour: {value!r}")
    return tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def rgb_to_hex(rgb: tuple[float, float, float]) -> str:
    return "#%02x%02x%02x" % tuple(max(0, min(255, round(c))) for c in rgb)


def parse_overlay(spec: str) -> tuple[float, float, float, float]:
    """Parse `rgba(r,g,b,a)` — the shape a glass surface is written in."""
    m = re.fullmatch(
        r"rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)",
        spec.strip(),
    )
    if not m:
        raise ValueError(f"not an rgb/rgba colour: {spec!r}")
    r, g, b = (float(m.group(i)) for i in (1, 2, 3))
    a = float(m.group(4)) if m.group(4) is not None else 1.0
    return r, g, b, a


def composite(overlay: tuple[float, float, float, float],
              base: tuple[float, float, float]) -> tuple[float, float, float]:
    """Flatten a translucent surface onto an opaque one (source-over)."""
    r, g, b, a = overlay
    return tuple(f * a + bk * (1 - a) for f, bk in zip((r, g, b), base))  # type: ignore[return-value]


def _linearize(channel: float) -> float:
    c = channel / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(rgb: tuple[float, float, float]) -> float:
    r, g, b = (_linearize(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


# ---------------------------------------------------------------------------
# Derivation
# ---------------------------------------------------------------------------

def solve_lightness(token: str, surfaces: dict[str, tuple[float, float, float]],
                    target: float) -> tuple[str, float, float, float] | None:
    """Smallest lightness move that clears `target` against the WORST surface.

    Grades against the worst rather than the average: a token is only as
    readable as the least forgiving place it lands.
    """
    rgb = hex_to_rgb(token)
    h, l0, s = colorsys.rgb_to_hls(*[c / 255 for c in rgb])

    def worst(candidate: tuple[float, float, float]) -> float:
        return min(contrast(candidate, bg) for bg in surfaces.values())

    def at(light: float) -> tuple[float, float, float]:
        return tuple(c * 255 for c in colorsys.hls_to_rgb(h, light, s))  # type: ignore[return-value]

    # Text on a dark ground brightens; on a light ground it darkens. Pick the
    # direction that actually improves the relationship rather than assuming.
    up_ok = worst(at(1.0)) >= target
    down_ok = worst(at(0.0)) >= target
    if not up_ok and not down_ok:
        return None  # No lightness clears it — the SURFACE is the defect.

    if up_ok:
        lo, hi = l0, 1.0
        for _ in range(80):
            mid = (lo + hi) / 2
            if worst(at(mid)) >= target:
                hi = mid
            else:
                lo = mid
        solved = hi
    else:
        lo, hi = 0.0, l0
        for _ in range(80):
            mid = (lo + hi) / 2
            if worst(at(mid)) >= target:
                lo = mid
            else:
                hi = mid
        solved = lo

    return rgb_to_hex(at(solved)), worst(at(solved)), l0, solved


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--token", required=True, help="current text colour, e.g. '#5a5a72'")
    ap.add_argument("--base", required=True, help="opaque page background, e.g. '#060611'")
    ap.add_argument("--overlay", action="append", default=[],
                    help="translucent surface over the base; repeatable")
    ap.add_argument("--floor", type=float, default=4.5,
                    help="contrast floor the role requires (4.5 AA, 7.0 AAA)")
    ap.add_argument("--headroom", type=float, default=0.8,
                    help="margin carried above the floor so the fix survives edits")
    args = ap.parse_args(argv)

    try:
        base = hex_to_rgb(args.base)
        surfaces: dict[str, tuple[float, float, float]] = {args.base: base}
        for spec in args.overlay:
            surfaces[spec] = composite(parse_overlay(spec), base)
    except ValueError as exc:
        print(f"derive_text_contrast: {exc}", file=sys.stderr)
        return 2

    current = hex_to_rgb(args.token)
    print(f"token {args.token} against {len(surfaces)} surface(s), floor {args.floor}:1\n")
    for name, bg in surfaces.items():
        r = contrast(current, bg)
        print(f"  {r:>6.2f}:1  {'PASS' if r >= args.floor else 'FAIL'}  {name}")

    worst_now = min(contrast(current, bg) for bg in surfaces.values())
    print(f"\n  worst: {worst_now:.2f}:1")

    if worst_now >= args.floor:
        print(f"\n{args.token} already clears {args.floor}:1. No change derived.")
        return 0

    target = args.floor + args.headroom
    solved = solve_lightness(args.token, surfaces, target)
    if solved is None:
        print(f"\nNo lightness of this hue clears {target:.2f}:1 — not even pure black or "
              f"white.\nThe SURFACE is the defect, not the text colour. Darken the "
              f"background\nor drop the opacity that is compressing the difference.")
        return 1

    new_hex, achieved, l0, l1 = solved
    at_floor = solve_lightness(args.token, surfaces, args.floor)
    print(f"\n  derived: {new_hex}   worst {achieved:.2f}:1"
          f"   (L {l0:.3f} -> {l1:.3f}; hue and saturation unchanged)")
    if at_floor:
        print(f"  bare floor would be {at_floor[0]} at {at_floor[1]:.2f}:1 — "
              f"no headroom, so not recommended.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
