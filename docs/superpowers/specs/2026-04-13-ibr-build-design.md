# /ibr:build — UI-Focused Build Orchestrator

**Status:** Draft — approved via brainstorming 2026-04-13
**Owner:** IBR plugin (`interface-built-right`)
**Plugin version target:** 0.9.0

---

## Purpose

`/ibr:build <topic>` is a thin UI orchestrator that sequences existing IBR skills, superpowers brainstorming, and writing-plans into a guided workflow for building good interfaces. It runs standalone for quick UI work and runs subordinate to `/build-loop` when called from a larger engineering task. It owns no new execution engine — it composes what already exists.

## Non-goals

- Not a general-purpose build loop. `/build-loop` covers that.
- Not a runtime server for mockup-gallery. IBR reads gallery data from the filesystem.
- Not a replacement for `/ibr:scan`, `/ibr:iterate`, `/ibr:replicate`, `/ibr:match`. It calls them.
- Not a rewrite of `superpowers:brainstorming`. It pre-fills context and delegates.

## Shape

Five phases, all stateful under `.ibr/builds/<topic>/`:

| Phase | What happens | Primary skill/command |
|---|---|---|
| 1. Preamble | Pick UI Guidance template, capture external refs, detect mockup-gallery selections, answer 4–6 UI axes | `ibr:ui-brainstorm-preamble` (new) |
| 2. Brainstorm | Delegate to superpowers with preamble pre-filled | `superpowers:brainstorming` |
| 3. Plan | Write implementation plan | `superpowers:writing-plans` |
| 4. Implement | Code with IBR design guidance in scope | `ibr:design-implementation`, `ibr:component-patterns`, `ibr:replicate` |
| 5. Validate & Iterate | Scan + mockup match + native-scan, loop up to 5× | `ibr:scan`, `ibr:match`, `ibr:native-scan`, `ibr:iterate` |

Subordinate mode (`--from=build-loop` or `BUILD_LOOP_CONTEXT=1`) skips phases 1–3 and reads `spec.md` from `.build-loop/specs/<topic>.md`. Build-loop has already brainstormed and planned; IBR only implements and validates.

---

## UI Guidance library contract

**Source of truth:** `/Users/tyroneross/Desktop/git-folder/UI Guidance/`
Current templates: `aurora-glass.md`, `aurora-deep.md`, `warm-craft.md`, `cross-platform-design-patterns.md`, `data-visualization-patterns.md`.

**New skill `ibr:ui-guidance-library`:**

- Indexes the central library and `.ibr/ui-guidance/drafts/` on demand.
- On template pick, copies chosen file to `.ibr/ui-guidance/active.md` (snapshot — central library can evolve without breaking past builds).
- Offers "new" path: captured brainstorm answers + token choices write to `.ibr/ui-guidance/drafts/<topic>.md`.

**New command `/ibr:ui-guidance list|show <name>|promote <slug>`:**
- `list` — enumerate central + project-local + drafts
- `show <name>` — print a template
- `promote <slug>` — explicit move from `.ibr/ui-guidance/drafts/<slug>.md` to `~/Desktop/git-folder/UI Guidance/<slug>.md` after user confirmation. Never auto.

**Precedence:** project-local (`.ibr/ui-guidance/active.md` and local drafts) overrides central library when both define the same token or rule — matches mockup-gallery's memory precedence pattern.

---

## External reference ingestion

IBR already has the primitives. `/ibr:build` wires them into Preamble as first-class inputs.

| Input | Existing capability | Role in build |
|---|---|---|
| URL screenshot (Mobbin, Dribbble, any site) | `/ibr:screenshot` + `design-reference` skill | Reference image, optional validation target |
| URL full extract (HTML + computed CSS + element tree) | `/ibr:replicate` URL mode → `reference.png` + `reference.html` + `reference.json` | Structured data for token derivation and component mapping |
| Uploaded image (Figma screenshot, sketch) | `/ibr:replicate` image mode | Reference image only, no HTML/CSS |
| Multi-page site / sitemap crawl | **Gap — new helper** | Multi-page reference set |

**New command `/ibr:capture <url>`:** convenience wrapper that offers screenshot-only, extract-full, or crawl-sitemap in one entry point. `/ibr:screenshot` stays as the low-level primitive.

**Sitemap crawl (new):**
- Input: seed URL + depth (default 1) + cap (default 10 pages)
- Behavior: fetch seed, discover same-origin `<a href>`, screenshot each with existing `ibr screenshot` MCP tool, write to `.ibr/references/<slug>/pages/`
- Implementation: small TypeScript helper in `src/crawl.ts`, reuses IBR's existing capture pipeline

**Reference manifest** (`refs.json` in the build dir):
```json
{
  "refs": [
    {"id": "mobbin-dashboard-1", "source": "https://...", "capturedAt": "2026-04-13T...", "tags": ["inspiration"], "path": "references/mobbin-dashboard-1.png"},
    {"id": "selected-dashboard", "source": "mockup-gallery", "tags": ["validation-target"], "path": "references/mockups/dashboard.html"}
  ]
}
```

Brainstorm and plan phases see this manifest. `ibr:match` uses `validation-target`-tagged refs as the pass/fail baseline.

---

## Mockup-gallery bridge

IBR reads mockup-gallery data via filesystem. No HTTP dependency on the gallery server.

**New skill `ibr:mockup-gallery-bridge`:**

Reads:
- `.mockup-gallery/ratings.json` — yay/nay + notes
- `.mockup-gallery/selected.json` — mockups assigned to pages/screens
- `.mockup-gallery/sessions/<current>/` — session-scoped data when sessions mode is on
- Gallery plugin memory files: `memories/global/design-preferences.md`, `memories/projects/<name>/*.md`

Writes (only on clean build completion):
- `.mockup-gallery/implemented.json` — entry linking build topic → selected mockup → commit hash → pass status

Behavior:
1. **Preamble detection:** if project has `mockups/` or `.mockup-gallery/`, offer to pull selections. If a mockup is selected for the page being built, auto-add to `refs.json` as `validation-target`. Gallery rating notes join brainstorm context as "user feedback on candidates."
2. **Validation:** `ibr:match` runs with the selected mockup as reference. SSIM threshold pulled from `.ibr/tokens.json` (default 0.85).
3. **Write-back:** on clean pass, append to `implemented.json` so the gallery's implementation tracking reflects reality.

IBR never spawns the gallery server. User runs `npx mockup-gallery` when they want to review.

---

## Brainstorm orchestration (hybrid)

Two layers, single user-facing experience.

**Layer 1 — IBR preamble** (new skill `ibr:ui-brainstorm-preamble`)

Asks ≤6 questions, multi-choice where possible:

1. **Platform** — web / iOS / macOS / cross-platform
2. **Scope** — component / page / flow / app
3. **UI Guidance template** — list from library + project drafts, or "new"
4. **External references** — URLs/images to capture now? (loops through `/ibr:capture`)
5. **Mockup-gallery selection** — auto-filled if detected, else "none"
6. **Density/intent** — compact-dense / balanced / spacious-marketing

Outputs: `preamble.json` + a brainstorm context block ready for injection.

**Layer 2 — superpowers delegation**

Invoke `superpowers:brainstorming` with preamble pre-filled. Superpowers opens with "Here's what's locked in: [preamble]. What's still open?" and runs its normal dialogue for goals, edge cases, isolation, architecture. Design doc lands at `.ibr/builds/<topic>/spec.md` (override of superpowers' default `docs/superpowers/specs/` path). Plan lands at `.ibr/builds/<topic>/plan.md`.

**Subordinate mode:** `/ibr:build --from=build-loop` skips both layers. Spec read from `.build-loop/specs/<topic>.md`; IBR jumps straight to Implement.

---

## Implement & validate loop

**Implement phase** dispatches existing skills in order:

1. `ibr:design-system` — sync tokens from `.ibr/ui-guidance/active.md` to `.ibr/tokens.json` if not present
2. `ibr:component-patterns` + `ibr:design-implementation` — guide the write (Claude edits code, no new engine)
3. If `refs.json` has `validation-target` — `ibr:replicate` seeds initial markup from `reference.json` structured data

**Validate phase** runs automatically after implement:

1. `ibr:scan` — accessibility, handlers, token compliance, computed CSS
2. `ibr:match` (SSIM) — only if `validation-target` exists; threshold from tokens
3. `ibr:native-scan` — if platform is iOS/macOS
4. Merge into `.ibr/builds/<topic>/iterations/<n>/report.json`

**Iterate** uses existing `ibr:iterate` — stagnant / oscillating / regressing detection already in place. Hard cap at 5 iterations (matches `debug-loop`). On cap hit: surface failing items, ask user. Never silently stop.

**Capture learnings:** on clean pass, rules enforced during iteration (e.g. "always full-width on mobile here") append to `.ibr/ui-guidance/active.md` as project overrides. Explicit promotion to central library stays manual via `/ibr:ui-guidance promote`.

---

## File layout

### New files in IBR plugin

```
commands/
  build.md                    # /ibr:build <topic>
  capture.md                  # /ibr:capture <url>
  ui-guidance.md              # /ibr:ui-guidance list|show|promote
skills/
  ui-brainstorm-preamble/
    SKILL.md
  ui-guidance-library/
    SKILL.md
  mockup-gallery-bridge/
    SKILL.md
src/
  crawl.ts                    # Same-origin link discovery, cap=10
  crawl.test.ts
```

### New data under `.ibr/builds/<topic>/`

```
preamble.json                 # Layer 1 answers
spec.md                       # Superpowers output (redirected here)
plan.md                       # Writing-plans output
refs.json                     # Reference manifest
references/                   # Captured screenshots / html / json
iterations/<n>/report.json    # Merged scan + match + native-scan
```

### UI Guidance dir contract (unchanged)

```
/Users/tyroneross/Desktop/git-folder/UI Guidance/
  aurora-glass.md  aurora-deep.md  warm-craft.md
  cross-platform-design-patterns.md  data-visualization-patterns.md
  archive/  mockups/
```

IBR reads; only writes on explicit `/ibr:ui-guidance promote`.

### Build-loop integration

Existing routing table in `build-loop/skills/build-loop/SKILL.md` already routes Web UI build to `ibr:design-implementation` etc. Add one row:

| Capability | Preferred | Secondary | Inline fallback |
|---|---|---|---|
| Orchestrated UI build | `/ibr:build --from=build-loop` | existing ibr skills in sequence | `fallbacks.md#web-ui` |

---

## Module boundaries

Each new unit is independently useful and testable:

| Unit | Purpose | Depends on |
|---|---|---|
| `ibr:ui-brainstorm-preamble` | 6-question UI context capture | `ui-guidance-library`, `mockup-gallery-bridge` |
| `ibr:ui-guidance-library` | Index + pick + snapshot templates | Filesystem only |
| `ibr:mockup-gallery-bridge` | Read gallery data, write implementation status | Filesystem only |
| `/ibr:capture` command | Screenshot / extract / crawl | Existing `ibr:screenshot` MCP tool, `src/crawl.ts` |
| `src/crawl.ts` | Same-origin sitemap discovery | `ibr:screenshot` |
| `/ibr:build` command | Sequence phases, hand off | All of the above + superpowers + existing ibr commands |
| `/ibr:ui-guidance` command | List / show / promote templates | `ibr:ui-guidance-library` |

A consumer of any unit should understand it without reading internals. Crawl.ts doesn't know about builds. The bridge doesn't know about brainstorming. The library doesn't know about mockups.

---

## Error handling & edge cases

- **No UI Guidance dir present:** fall back to bundled Calm Precision defaults; surface a warning.
- **Mockup-gallery dir missing:** preamble skips step 5 silently.
- **`/ibr:capture` on a site that blocks headless browsers:** surface error, ask for manual upload path.
- **Sitemap crawl exceeds cap:** stop at cap, list skipped URLs in `refs.json`.
- **Subordinate mode spec missing:** error out with clear pointer to `.build-loop/specs/` path — do not fall through to brainstorming.
- **Iteration cap hit:** surface failing scan items and the SSIM diff; user decides continue / accept / abort. Never silent.
- **Token file missing:** `ibr:design-system` generates from chosen template on first run.
- **Central library write:** `/ibr:ui-guidance promote` requires explicit `--confirm` flag; otherwise dry-run listing what would move.

---

## Testing

- `crawl.test.ts` — unit tests for same-origin discovery, cap enforcement, malformed HTML handling
- `ibr:ui-guidance-library` — integration test against fixture dir
- `ibr:mockup-gallery-bridge` — read/write contracts against fixture `.mockup-gallery/`
- Full `/ibr:build` flow — e2e test in `test/ibr-build/` driving a fixture project through all phases end to end

---

## Rollout

1. Version bump to 0.9.0.
2. Update 11-file version checklist (see `feedback_ibr_version_checklist.md` in user memory).
3. Update `build-loop` routing table to add `/ibr:build --from=build-loop`.
4. Doc updates: `README.md`, `CLAUDE.md`, `AGENTS.md`, `commands/` index.
5. Smoke test against an existing project (Atomize AI or Travel Planner) with mockup-gallery data.

---

## Open questions (none blocking — to revisit during implementation)

- Should `/ibr:capture` respect `robots.txt` on crawl? Default yes, opt-out flag.
- Should "capture learnings" require user approval per-rule, or aggregate at end of build? Lean toward end-of-build summary with opt-in.
- SSIM default threshold (0.85) — tune after first real build.
