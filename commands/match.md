---
description: Compare a design mockup PNG against a live rendered web page using SSIM and pixel diff. Returns a pass/review/fail verdict.
argument-hint: <mockup.png> <url>
---

# /ibr:match

Compare a design mockup (PNG file) against a live rendered page to measure how closely the implementation matches the design intent.

Uses two complementary algorithms:
- **SSIM** (Structural Similarity Index) — perceptual similarity: luminance, contrast, and structure. Score from 0.0–1.0.
- **pixelmatch** — pixel-level diff for visualization and exact change count.

## Verdicts

| SSIM Score | Verdict | Meaning |
|-----------|---------|---------|
| > 0.85 | PASS | Implementation closely matches mockup |
| 0.70–0.85 | REVIEW | Noticeable differences — human review recommended |
| < 0.70 | FAIL | Significant deviation from mockup |

## Usage

```bash
# Basic comparison
npx ibr match mockup.png http://localhost:3000

# Compare only a specific section
npx ibr match mockup.png http://localhost:3000 --selector '.hero-section'

# Auto-mask timestamps, ads, and live regions before comparison
npx ibr match mockup.png http://localhost:3000 --mask-dynamic

# Save the pixel diff image for visual inspection
npx ibr match mockup.png http://localhost:3000 --save-diff diff.png

# JSON output (for scripting / CI)
npx ibr match mockup.png http://localhost:3000 --json
```

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `<mockup>` | (required) | Path to mockup PNG file |
| `<url>` | (required) | URL of the live page to compare against |
| `--selector <css>` | — | Crop live screenshot to this CSS selector |
| `--mask-dynamic` | false | Auto-mask timestamps, timers, ads, live regions |
| `--save-diff <path>` | — | Save pixel diff PNG to this path |
| `--json` | false | Machine-readable JSON output |
| `-v, --viewport <name>` | from mockup | Override viewport (desktop, mobile, tablet) |

## Example Output

```
Mockup Match: hero-section
  SSIM: 0.9241 (PASS)
  Pixel diff: 1.2% (847 pixels)
  Mockup: 1920x1080
  Live: 1920x1080
  Masked: 2 regions (timer, ad-banner)
```

## How It Works

1. Reads the mockup PNG and extracts its dimensions
2. Launches Chrome with rendering normalization (`--disable-lcd-text`, `--force-device-scale-factor=1`) for consistent pixel output
3. Navigates to the URL and waits for render stability
4. If `--selector` is set, clips the screenshot to that element's bounds
5. If `--mask-dynamic` is set, queries the accessibility tree for time-related roles and known ad patterns, then paints those regions gray in both images
6. Computes SSIM across overlapping 8x8 windows
7. Runs pixelmatch for the visual diff image

## Exit Codes

- `0` — PASS (SSIM > 0.85)
- `1` — REVIEW or FAIL (SSIM <= 0.85)

## Workflow Integration

```bash
# In CI: fail if mockup match drops below pass threshold
npx ibr match designs/hero.png http://localhost:3000 --selector '.hero' --json

# During development: iterate with diff images
npx ibr match mockup.png http://localhost:3000 --save-diff /tmp/diff.png
open /tmp/diff.png
```

## When to Use

| Situation | Command |
|-----------|---------|
| Verify a full page matches a Figma export | `ibr match mockup.png <url>` |
| Verify a single component matches its design | `ibr match mockup.png <url> --selector '.component'` |
| Page has dynamic data (timestamps, live stats) | Add `--mask-dynamic` |
| Investigate a low SSIM score visually | Add `--save-diff diff.png` |
| Structured CSS/handler/a11y audit (not visual) | Use `ibr scan` instead |
