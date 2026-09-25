# Container fit check

Use this when text, typography, spacing, or navigation layout changes. The
unit of review is the rendered text **inside its actual parent container**,
not a string or component viewed on its own.

## Record before implementation

- **Surface and parent:** name the screen, sheet, card, row, or toolbar and its
  real parent. Account for safe areas, padding, adjacent controls, and fixed
  headers/footers.
- **Constrained case:** choose the smallest relevant supported width/height;
  include large text and a realistic long title/body value when they can
  change wrapping. Use the app's supported bounds, not a universal width.
- **Text behavior:** name the semantic style, allowed lines, wrapping or
  truncation rule, and which actions must remain visible or scroll into view.

## Verify after implementation

1. Open the real screen at the constrained case with representative content.
2. Capture a screenshot and an AX/DOM scan when available. A wide-screen scan
   does not prove a narrow sheet fits.
3. Inspect the text and its parent for clipped glyphs, split words, accidental
   wrapping, overlap, and controls hidden by footers. Check the last item at
   scroll end. DOM/AX bounds help locate issues; pixels decide visual fit.
4. Record `surface`, measured `container`, `constraint`, `content`, `evidence
   path`, and `pass|fail|unverified`. On failure, adjust hierarchy, copy, or
   layout and repeat the same probe. If capture cannot run, name the blocker;
   do not report a build or source check as visual proof.

For web, use IBR `scan` at the selected viewport and inspect the screenshot.
For iOS/watchOS, scan the booted app and read a session screenshot; for macOS,
scan the running app by PID and capture its window. Prefer a targeted fixture
or debug seed for long and populated states over manually recreating data.
