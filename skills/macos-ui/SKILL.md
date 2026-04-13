---
name: macos-ui
description: macOS native UI best practices — window/toolbar/sidebar patterns, menu bar discipline, keyboard-first, NSVisualEffectView materials, multi-window, Liquid Glass (macOS 26). Includes Apple documentation entry points for notarization, Developer ID, App Store and direct distribution. Use when building AppKit/SwiftUI apps for Mac, or when `/ibr:build` preamble returns platform=macOS.
version: 0.1.0
user-invocable: false
---

# macOS UI

HIG-derived rules for Mac apps. Research context: `docs/research/2026-04-13-mobile-ui-best-practices.md`.

## Windows

- **Full-size content view** is the modern default — content extends under the translucent titlebar. Use materials so toolbar vibrancy works
- Windows resizable unless content truly can't reflow
- Persist size + position across launches
- Support `NSWindow` tabbing (⌘T) when the app is document-based or browsable

## Toolbars, sidebars, inspectors

- **Sidebar (source list)**: `.sidebar` material, translucent with vibrancy. Shows hierarchy / top-level areas
- **Toolbar**: primary actions + search for current window; respect user customization
- **Inspector**: right-side contextual details panel; toggleable

## Menus

Menu bar is first-class. Every command the user can invoke should be reachable from the menu bar — power users expect it.

**Sacred shortcuts** (never rebind):
- ⌘N / ⌘O / ⌘S / ⌘W / ⌘Q
- ⌘Z / ⇧⌘Z — undo/redo
- ⌘X / ⌘C / ⌘V — cut/copy/paste
- ⌘F — find
- ⌘, — preferences/settings
- ⌘? — help
- Control-⌘-F — full screen

Context menus supplement, never replace, menu bar items.

## Keyboard-first

- Every interactive element tab-reachable
- Focus ring visible (WCAG 2.4.7)
- No mouse-only features

## Pointer targets

Apple does not publish a single "macOS minimum target size" equivalent to iOS 44pt. Use **WCAG 2.5.8 (24×24 px) as floor**, 28–32 pt for standalone buttons. Hover states expected — cursor changes (I-beam, pointingHand, openHand).

## Vibrancy + materials

- `NSVisualEffectView` materials: sidebar, titlebar, menu, popover, HUD
- Vibrancy pulls color through material — use vibrant label/fill/separator variants
- Four vibrancy levels: default (highest contrast) → quaternary (lowest)
- **macOS 26 Tahoe Liquid Glass**: translucent menu bar, Dock, Control Center. Desktop icons react to light/dark + tint. Verify exact SwiftUI modifier names against live Xcode docs before quoting

## Colors

Same semantic-first rule as iOS — use `NSColor.labelColor`, `NSColor.controlBackgroundColor`, `NSColor.separatorColor`. In SwiftUI, `Color(NSColor.labelColor)` or `Color.primary`.

## Typography

Default body = 13pt SF Pro on macOS (vs 17pt iOS). Match macOS system font scale — don't transplant iOS sizes.

## Distribution

### Path A — App Store

- Submit via Xcode Organizer → App Store Connect
- Full Apple review
- Sandbox required (entitlements declared in .entitlements)
- Universal binary: arm64 + x86_64 unless dropping Intel

### Path B — Direct / Sparkle

- **Developer ID** signed **+ notarized** — required since 2019 for Gatekeeper to pass silently
- Sparkle updaters: nested executables must also be Developer ID signed + timestamped, or notarization fails
- No sandbox required (but recommended)

## Apple documentation — canonical entry points

**HIG:**
- [HIG hub](https://developer.apple.com/design/human-interface-guidelines)
- [HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [HIG Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)

**AppKit:**
- [NSVisualEffectView](https://developer.apple.com/documentation/appkit/nsvisualeffectview)

**Distribution:**
- [Notarizing macOS software](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
- [Developer ID (signing for outside-MAS distribution)](https://developer.apple.com/developer-id/)
- [Xcode — Distribute an app through the App Store](https://help.apple.com/xcode/mac/current/en.lproj/dev067853c94.html)
- [Xcode — Preparing your app for distribution](https://developer.apple.com/documentation/xcode/preparing-your-app-for-distribution/)
- [Xcode — Distributing for beta/releases](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)

**Keyboard reference:**
- [Mac keyboard shortcuts (apple.com/102650)](https://support.apple.com/en-us/102650)

## Anti-patterns

- Hiding commands only in context menus (menu bar must have them)
- Rebinding sacred shortcuts
- Fixed-size windows for content that could reflow
- Hardcoded colors / fonts
- Transplanting iOS 17pt body directly — feels too large on Mac
- Shipping Intel-only binaries on Apple Silicon era
- Direct distribution without notarization → silent Gatekeeper fail for users
