# Calm Precision 6.6.0 — Deep Audit Framework

Comprehensive audit checklists, anti-patterns, strict/flexible zones, semantic tokens, and accessibility.

## Anti-Patterns (26)

| Pattern | Violation | Fix | Audit |
|---------|-----------|-----|-------|
| Individual borders on list items | Gestalt | Single group border + dividers | "Group or isolate?" |
| Full-width for quick actions | Fitts | Compact inline | "Size = intent?" |
| Status badges with backgrounds | S/N | Text color only | "Decoration aids comprehension?" |
| Nav boxes on active tab | Cog Load | Text + bottom border | "Button or state?" |
| >2 icon colors in context | Cog Load | 2 semantic colors | "Count colors ≤2?" |
| Non-functional buttons | Affordance | Only interactive if action exists | "Click → something happens?" |
| Mock data looks real | Data Integrity | Demo label or hide | "Real data or mock?" |
| Forms without APIs | Functional | Don't build until backend exists | "Where does this submit?" |
| Strict content schemas | Brittleness | Accept string OR object | "Handles variable formats?" |
| Desktop-first classes | Mobile-First | Base = mobile, breakpoints add | "First class targets mobile?" |
| All tags visible on mobile | Cog Load | 2-3 visible + count | "Mobile view cluttered?" |
| Small touch targets | Fitts | ≥44px on mobile | "Thumb easily tap this?" |
| Input font <16px | iOS | text-base minimum | "Will iOS auto-zoom?" |
| Bare numeric KPIs | Resilience | Semantic label beneath value | "Number make sense alone?" |
| Lift on non-interactive cards | Functional | No lift, no shadow, no pointer | "Falsely signaling interactivity?" |
| Full lift on cards w/ inline actions | Fitts | Subtle lift (-translate-y-px) | "Card lift compete w/ inner buttons?" |
| No hover on interactive cards | Affordance | Add lift or press-in | "Can user tell it's clickable?" |
| Simultaneous change on 3+ items | Temporal Gestalt | Stagger 40-80ms | "Everything snap at once?" |
| Stagger >400ms total | Cog Load | Cap at 5, batch rest | "Sequence feel sluggish?" |
| Forward stagger on removal | Mental Model | Simultaneous or reverse | "Exit feel hesitant?" |
| "Something went wrong" | Cooperative Principle | Three-part: what → why → fix | "User know what to do?" |
| "No results found" | Mental Models | Context-matched CTA + value | "Empty state help or dead-end?" |
| "Loading..." without context | Pragmatic Inference | State what's loading | "User know what they're waiting for?" |
| Button labels >3 words | S/N | Verb + Object ≤3 words | "Scan in <1 second?" |
| Multiple L1 anchors | Attentional Cascade | Demote all but one | "Where does eye land first?" |
| Nav dominates page title | Page Hierarchy | L2 subordinate to L1 | "Nav overwhelm content?" |

## Deep Audit by Principle

### Gestalt (Grouping)
- [ ] Related items share container with single border?
- [ ] Dividers between items, not around each?
- [ ] Unrelated items have whitespace/headers?

### Fitts (Size)
- [ ] Core conversions use full-width?
- [ ] Equal choices use side-by-side?
- [ ] Quick actions use compact?
- [ ] Touch targets ≥44px mobile, ≥24px desktop?

### Cognitive Load (Predictability)
- [ ] Three-line pattern consistent?
- [ ] Same elements in same positions?
- [ ] Vertical rhythm on 8pt grid?

### Signal-to-Noise (Clarity)
- [ ] Status uses text color only?
- [ ] Icons ≤2 colors?
- [ ] Decoration serves comprehension?

### Hick (Disclosure)
- [ ] Detail revealed on demand?
- [ ] Filters collapsible?
- [ ] Advanced options hidden initially?

### Mental Models (Language)
- [ ] Labels match user vocabulary?
- [ ] Error messages explain what/why/how?
- [ ] Time relative <24h ("2h ago")?

### Content Focus
- [ ] Content-chrome ≥70%?
- [ ] Search prominent?
- [ ] Navigation doesn't dominate?

### Affordance (Integrity)
- [ ] All interactive elements have actions?
- [ ] Non-functional items don't look clickable?
- [ ] States clearly marked (disabled, coming soon, pro)?
- [ ] Backend APIs verified before building UI?
- [ ] Mock data clearly labeled as demo?
- [ ] Forms have real submission endpoints?

### Resilience (Content)
- [ ] Accepts multiple input formats?
- [ ] Tries alternative field names?
- [ ] Supports basic markdown?
- [ ] Handles null/undefined gracefully?
- [ ] Metrics include contextual labels?
- [ ] Error states follow three-part pattern?
- [ ] Empty states include actionable CTA?

### Mobile-First
- [ ] Base classes target mobile?
- [ ] Breakpoints add complexity (not remove)?
- [ ] Touch targets ≥44px?
- [ ] Content truncated appropriately?
- [ ] Tags/items limited + count?
- [ ] Actions stacked on mobile?
- [ ] Input font ≥16px?
- [ ] Safe area padding present?
- [ ] Active states on tappables?

### Interaction (Purposeful Motion)
- [ ] Interactive cards have hover lift (desktop)?
- [ ] Interactive cards have press-in (mobile)?
- [ ] Non-interactive cards have NO lift?
- [ ] Card lift intensity matches interaction type?
- [ ] Multi-element transitions stagger 40-80ms?
- [ ] Total stagger ≤400ms?
- [ ] Exit transitions simultaneous or reverse-faster?
- [ ] All motion respects prefers-reduced-motion?

### Voice & Content Strategy
- [ ] Button labels follow Verb + Object ≤3 words?
- [ ] Placeholder text uses instruction, not description?
- [ ] Tooltips ≤8 words answering "what does this do?"?
- [ ] Loading messages state what's happening?
- [ ] Confirmation messages state what changed?
- [ ] Destructive actions show consequence + reversibility?
- [ ] Error messages route by type (user/system/permission/data)?
- [ ] Empty states match context (first-time/search/filter/complete)?

### Page Hierarchy
- [ ] Exactly one L1 anchor per page?
- [ ] L1 is the largest, highest-contrast element?
- [ ] L2 (nav/controls) is visually subordinate to L1?
- [ ] L3 (primary content) gets ≥60% of mobile viewport?
- [ ] L4 (supporting) can hide on mobile without breaking the page?

## Strict vs Flexible Zones

### Strict (audit as violations)
- Group vs individual borders
- Button sizing by context
- Three-line hierarchy
- Touch targets ≥44px mobile
- Contrast ≥4.5:1 text, ≥3:1 large
- Content-chrome ≥70%
- Functional integrity (no fake buttons)
- Real data sources required
- Mobile-first class ordering
- Content truncation on mobile
- Interactive cards must have lift/press-in affordance
- Non-interactive cards must NOT have lift
- Isolated metrics must include contextual labels
- Stagger ≤400ms total for group transitions
- Button labels ≤3 words, Verb + Object format
- Error messages must follow what → why → fix structure
- Empty states must include actionable CTA
- Exactly one L1 anchor per page
- L3 content ≥60% of mobile viewport
- Loading messages must state what's happening

### Flexible (maintain principle, vary implementation)
- Color values (maintain contrast ratios)
- Border radius (stay consistent)
- Font family (maintain size/weight ratios)
- Spacing values (stay on 8pt grid)
- Lift translation amount (1-3px range)
- Stagger timing (40-80ms range)
- Shadow color tint on lift
- Metric label positioning (below or beside)
- Tone choice per context (neutral, encouraging, urgent, celebratory)
- L1 anchor placement (top-left vs center)
- Error icon choice (maintain severity mapping)

## Accessibility (WCAG 2.2 AA)

### Non-Negotiable Minimums

| Requirement | Minimum |
|------------|---------|
| Text contrast | 4.5:1 normal, 3:1 large |
| Touch targets | 44×44px mobile, 24×24px desktop |
| Focus indicators | Visible on all interactive |
| Color + text/icon | Never color alone |
| Motion | Honor prefers-reduced-motion |

### Quick Checks
- [ ] Keyboard navigate entire UI?
- [ ] Focus visible on all interactive?
- [ ] Information clear without color?
- [ ] Touch targets meet minimums?
- [ ] Animations stop with reduced motion?
- [ ] Skip link for keyboard users?
- [ ] Input font ≥16px (iOS zoom)?
- [ ] Safe area padding for notch?
- [ ] Active states on all tappable?
- [ ] Card lift reduces to border-only when motion restricted?
- [ ] Stagger transitions become instant when motion restricted?
- [ ] Error messages explain what/why/fix?
- [ ] Empty states provide actionable guidance?
- [ ] Loading states describe what's happening?

## Semantic Tokens

```
Contrast:
  high    → ~7:1   → main text, L1 anchor
  medium  → ≥4.5:1 → descriptions, L3 content
  low     → ≥3:1   → metadata, metric labels, L4 supporting
  accent  → ≥4.5:1 → links, selected, metric values

Surface:
  base      → page background
  elevated  → cards, raised elements
  grouped   → container for list groups

Border:
  group    → outer group border
  divider  → dividers within groups
  subtle   → hairline separators

Touch:
  primary   → 48px (h-12)
  secondary → 44px (h-11)
  minimum   → 44px (w-11 h-11)

Motion:
  lift.full    → -translate-y-0.5 (2px)
  lift.subtle  → -translate-y-px (1px)
  press        → scale-[0.98]
  duration     → 200ms desktop, 100ms mobile
  stagger      → 60ms per item (40-80ms range)
  easing       → ease-out entry, ease-in exit

Metric:
  value   → text-sm font-bold (14px, accent or high contrast)
  label   → text-[10px] text-gray-400 (muted, subordinate)
  spacing → mt-0.5 (2px gap)

Page Hierarchy:
  L1 → text-2xl md:text-3xl font-bold (anchor)
  L2 → text-sm font-medium (orient/nav)
  L3 → three-line pattern (primary content)
  L4 → text-xs text-gray-500 (supporting, hideable)

Voice:
  button  → Verb + Object, ≤3 words
  error   → what → why → fix, ≤1 sentence each
  empty   → value promise + CTA, context-matched tone
  loading → action + count/context, ≤5 words
  confirm → what happened + delta, ≤8 words
  tooltip → "what does this do?", ≤8 words
```

## UI Testing Data Protocol

### Default: Use real data for all UI testing

Real data catches issues mock data hides: API response shape mismatches, edge cases in actual content, performance with realistic volumes, auth/permission edge cases.

### Mock data requires explicit permission

Before using mock data, state:
1. **What's being tested** — specific component/flow
2. **Why real data unavailable** — backend not ready, data sensitivity
3. **Risks acknowledged** — false positives, missed integration bugs
4. **Plan for real data** — when real data testing happens

**Acceptable:** Backend not implemented, destructive data, scale testing, sensitive PII.
**Not acceptable:** "It's faster," "Mock is easier," "We'll test later" without plan.

## Adaptation Notes

### With Existing Brand
**Adapts:** Primary color, font family, border radius, illustration style, lift shadow tint, voice tone defaults, L1 placement.
**Strict:** Grouping logic, button sizing, hierarchy, ratios, touch targets, functional integrity, backend requirements, mobile-first ordering, card lift/press affordance, metric labels, stagger timing, button label structure, error three-part pattern, page hierarchy.

### With Platform Conventions
**Respect:** iOS HIG, Android Material, Web standards.
**Maintain:** Grouping, sizing, hierarchy, content focus, data integrity, mobile patterns, interaction affordances, voice calibration patterns, page-level cascade.

## Version History

| Version | Changes |
|---------|---------|
| 6.2 | Mobile-first foundations, touch targets, content truncation, action stacking, safe area padding |
| 6.2.1 | Mobile enhancement patterns: swipe actions, bottom sheet, pull-to-refresh, haptic feedback |
| 6.2.2 | Interaction patterns: contextual metric labels, card lift affordance, staggered transitions |
| 6.3 | Consolidation: unified 6.2-6.2.2. 12 principles, 27 rules, 23 audit questions |
| 6.4.1 | Content strategy: Voice Calibration (P13), Error/Empty State routing (extends P10), Page-Level Hierarchy (extends P3). 13 principles, 30 rules, 26 audit questions, 26 anti-patterns |
