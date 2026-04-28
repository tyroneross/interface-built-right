---
name: mobile-web-ui
description: Use when building responsive web UI for phones, or when /ibr:build preamble returns platform=web mobile. Covers viewport/safe-area, thumb zones, touch, Material 3, iOS Safari, WCAG 2.2.
version: 0.1.0
user-invocable: false
---

# Mobile Web UI

Opinionated rules for mobile-first web. Full research context + citations: `docs/research/2026-04-13-mobile-ui-best-practices.md`.

## Non-negotiables

- `<meta name="viewport" content="width=device-width, initial-scale=1">` — prevents iOS 300ms click delay
- `100dvh` for true viewport (not `100vh` — includes dynamic chrome)
- `env(safe-area-inset-bottom)` for home-indicator clearance
- `prefers-reduced-motion` honored for every non-essential animation (WCAG SC 2.3.3)

## Touch targets (WCAG 2.2)

| Standard | Size | Use as |
|---|---|---|
| WCAG 2.5.8 (AA minimum) | 24×24 CSS px | Legal floor — not a design target |
| WCAG 2.5.5 (AAA enhanced) | 44×44 CSS px | Working minimum |
| Material Design 3 | 48×48 dp | Preferred for Android-targeted web |

Default: **44×44 px** for tap targets. Full-width primary CTAs in the bottom 25–40% of viewport (natural thumb zone — NN/g: 96% tap accuracy vs 61% in stretch zone).

## Color roles (Material 3)

Never hardcode hex. Use role tokens so dark mode + theming work.

- **Semantic**: `on-surface`, `surface`, `outline`, `error`
- **Accent/Tint**: `primary`, `secondary`, `tertiary`
- **Surface containers** (5 levels): `surface-container-lowest` → `-highest` — tonal elevation replaces shadow-only depth

## Typography (Material 3)

5 roles × 3 sizes — Display (57/45/36), Headline (32/28/24), Title (22/16/14), Body (16/14/12), Label (14/12/11). Weights limited to Regular or Medium. Body Large (16px) for primary reading.

## Forms

- `inputmode` / `type="email|tel|number|url"` for correct mobile keyboard
- `autocomplete` tokens for autofill
- Labels outside inputs — never placeholder-as-label (fails WCAG 1.3.1)
- Error states = color + icon + text (WCAG 1.4.1 — not color alone)
- Field height ≥ 44px

## iOS Safari specifics

- No hover — use `@media (hover: hover)` for desktop-only affordances
- No automatic PWA install prompt — instruct user to Share → Add to Home Screen
- Push notifications supported since iOS 16.4
- **50 MB Safari cache ceiling** — plan offline-first accordingly
- No access to Face ID / Touch ID / BLE / USB / full accelerometer from web

## Material 3 motion

Use the motion-physics springs for interactive transitions (M3 Expressive, May 2025). Durations/easings still documented for non-interactive. Always respect `prefers-reduced-motion`.

## Performance budgets that shape UX

- LCP < 2.5s, INP < 200ms, CLS < 0.1
- Chunk main-thread tasks >50ms
- Prefer `transform` / `opacity` for animation (compositor-only)

## Anti-patterns

- `:hover` used to reveal primary content → broken on touch
- Fixed headers/FABs that eat >30% of viewport
- Hardcoded hex instead of role tokens
- Color-only error signaling
