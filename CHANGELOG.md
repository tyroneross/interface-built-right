# Changelog

Format loosely follows [Keep a Changelog](https://keepachangelog.com/). Tagged,
per-version release notes for shipped versions live under `docs/releases/`
(e.g. `docs/releases/v1.4.0.md`); this file tracks the current in-progress
increment before it is cut into a release.

## Unreleased

### Changed (BREAKING for exit-code consumers)

- **`ibr scan` now runs accessibility rules by default.** `touch-targets`,
  `wcag-contrast`, and `calm-precision` run with no flag. Previously the preset
  engine ran ONLY when `--rules` was passed, and no `.ibr/rules.json` means an
  empty config, so a bare `ibr scan <url>` checked no contrast and no touch
  targets and still printed a verdict. Precedence is `--rules` > `.ibr/rules.json`
  > the built-in defaults; `--rules none` (or `--no-rules`) restores the previous
  behavior. `ibr audit` falls back to the same three presets instead of `minimal`.

  **Exit-code impact.** Preset violations now land in `issues`, and the verdict
  is computed after they are aggregated (it was computed before, so a scan could
  print a contrast ERROR and still report `PASS`). Three errors is `FAIL`, and
  the CLI exits 1 on `FAIL`. A previously green `ibr scan` in a script or CI step
  can now exit 1. That is the intended behavior — the old exit 0 was reporting on
  checks that never ran — but it is a real break for anything gating on the exit
  code. Pin the old behavior with `--rules none` if you need to stage the change.

### Fixed

- **IBR-owned Chrome processes no longer accumulate after interrupted runs.**
  Local launches now reap orphaned IBR-profile Chrome main processes, old
  `SingletonLock` files recover after a Mac hostname change when no Chrome uses
  the profile, and persistent CLI/MCP sessions close after one idle hour by
  default. `IBR_SESSION_IDLE_MS` changes the threshold; `0` disables it. The
  ownership check requires an IBR profile plus a CDP port and excludes Chrome
  helpers and the user's normal Chrome profile.

- **Contrast is measured on text over a transparent background.** The rule bailed
  on any non-`rgb` background, and `transparent` / alpha-0 parse to "no color" —
  so on a real page, where text computes `background-color: rgba(0, 0, 0, 0)`,
  it silently measured nothing and reported zero findings. The effective
  background is now composited through the ancestor chain; with no opaque
  ancestor, white is assumed, the ratio is still reported, and the finding says
  it assumed.

- **Body copy and headings are contrast-graded.** Only interactive elements
  reached the rule engine; headings and paragraphs were extracted afterwards
  under an opt-in flag. Content now runs through a text-only rule surface, so
  touch-target and handler rules still never see a paragraph. List items, table
  cells, labels, and captions are included.

- **One contrast implementation, not three.** `wcag/contrast` (always-on,
  `ScanResult.ruleEngine`), the `wcag-contrast` preset pair
  (`ScanResult.issues`), and the `sensors.contrast` report each carried their own
  color math and their own version of the same transparent-background bail. All
  three now share `measureElementContrast`.

- **WCAG large-text thresholds actually apply.** `isLargeText` read `fontSize`
  and `fontWeight`, which neither extractor captured, so every element on every
  scan was graded against the 4.5:1 normal-text bar. A 32px bold heading at
  3.03:1 passes AA large text and was reported as a failure.

- **Element opacity is honored.** `opacity` was captured and never used, so
  `opacity: 0.6` muted text was graded at full strength (real failures passed
  silently) while `opacity: 0` and `visibility: hidden` text was graded and
  reported despite being unpainted.

- **Coverage is reported, not implied.** `ScanResult.rulesApplied` names the
  presets that ran and the tags graded; `ScanResult.contrastCoverage` reports how
  much text was measured, assumed-white, or undecodable. `--output summary` now
  keeps both. Zero findings and zero measurements are no longer
  indistinguishable.

### Added

- **General breadcrumb auditing in every web scan.** IBR now recognizes
  breadcrumb trails by accessible name or conventional component markers and
  checks the WAI-ARIA APG contract: a labelled navigation landmark, semantic
  list structure, and exactly one final `aria-current="page"` when the current
  item remains a link. A plain-text current item is accepted without
  `aria-current`, matching the pattern's explicit exception. Existing mobile
  target-size rules continue to grade every breadcrumb link independently.

- **Impact-targeted validation guidance.** IBR now selects checks from the
  specified change and its affected components, routes, states, viewports, and
  shared dependencies. It expands beyond that set only when impact is uncertain,
  a shared dependency changed, or a targeted failure indicates wider breakage;
  running every route or every test is no longer the default validation pattern.

- **Artifact lane — author, check, and port single-file self-contained HTML pages.**
  A page that carries its own styles, scripts, fonts, and images: openable from
  `file://`, publishable through Claude's Artifact tool, and checkable by any agent.
  Unlike the rest of IBR this lane needs no browser, no MCP server, and no Node.

  - `scripts/artifact_lint.py` — 39-rule contract across six families: `AX*`
    portability and self-containment, `AD1xx` the three-state theme contract,
    `AD2xx` page identity, `AD3xx` layout and robustness, `AD4xx` AI-cliché
    detection, `AS5xx` inline-SVG diagrams. Stdlib-only Python 3, no network.
    `rules --json` is the machine-readable contract — the single source of truth
    for IDs, severities, and profile scope.
  - `scripts/artifact_build.py` — `new` scaffolds a page that already satisfies the
    theme contract and lints clean; `wrap`/`unwrap` convert losslessly between the
    Claude publish fragment and an openable document; `info` reports profile, title,
    injected nodes, and external URLs. Everything injected carries
    `data-artifact-build` and is removed on the way out, so round-trip is lossless.
  - `skills/artifact-design/` + `skills/artifact-diagramming/` — the judgment layer
    a linter cannot grade: treatment calibration, palette and type direction, page
    naming, copy, and what earns a diagram. They cite rule IDs rather than restating
    rules, so prose cannot drift from code.
  - `commands/artifact.md` (`/ibr:artifact`) and `.codex-plugin/skills/artifact/` —
    equal access from Claude, Codex, and any host that can run `python3`.

  **Severity policy:** only mechanically unambiguous rules carry `error`. Every
  heuristic is flagged `heuristic: true` and ships `warn`/`info` so it can never
  hard-block. Rule precision is unmeasured; `test_heuristic_rules_never_error` and
  `test_every_rule_is_reachable` enforce both invariants.

  96 tests across `scripts/test_artifact_lint.py` and `scripts/test_artifact_build.py`;
  every rule is asserted in both directions — it fires on a defect fixture and stays
  silent on the clean one.

### Fixed

- **Patched the production `nanoid` dependency to 5.1.16.** This removes the
  denial-of-service advisory affecting non-secure ID generation in 5.1.15.

- **Touch-target rules graded the wrong box, and graded targets WCAG exempts.**
  With viewport emulation fixed in 1.5.0 the rules measured the right layout, but
  two finding classes remained false by construction. On `rosslabs.ai` at both
  viewports they were **every** surviving finding on some pages — a gate whose
  output is entirely unactionable teaches the reader to ignore it, which is the
  failure mode the pooled-viewport bug already caused once.

  - **Inline prose links.** An `<a>` inside a sentence measured its text box
    (91x18px) and was flagged. WCAG 2.5.8 exempts a target "in a sentence or
    whose size is otherwise constrained by the line-height of non-target text";
    growing one to 44px would reflow the paragraph.
  - **Label-overlay controls.** An `sr-only` `<input>` whose hit area is supplied
    by an associated visible `<label>` measured at its own size (1x1px for the
    CSS-only nav-toggle pattern) while the label — the thing a finger lands on —
    measured 44x44. Above the label's breakpoint, where the label is
    `display: none`, the 1x1 stub has no pointer affordance at all to size.

  Fixed by measuring the real activation rect and applying the standard's own
  exception, in one shared policy module (`src/rules/target-sizing.ts`) used by
  every touch-target grading site: `ask`, the `touch-targets` preset (including
  its `error`-severity mobile rule), the `minimal` preset, and `scan`'s
  `analyzeElements`. `src/extract.ts` measures the two DOM inputs the policy
  needs — surrounding non-target text, and associated-label bounds.

  **Precision measured before any change to severity**, over 8 page x viewport
  combinations on `rosslabs.ai`: **33% before (7 genuine of 21 findings) → 100%
  after (7 of 7)**, with all 7 genuine findings preserved. Severity is unchanged.
  Counterexamples are asserted, not assumed: an `inline-block`/`inline-flex`
  control in prose, a `|`-separated inline nav, a paragraph whose only content is
  a link, an undersized `<label>` (the finding now reports the label's bounds so
  the fix targets the right element), and any control large enough to point at
  all stay flagged.

  Nothing is dropped silently — `ask` reports what it skipped under
  `meta.exempted`, keyed by reason (`wcag-inline`, `label-hit-area`).

  46 new tests: policy unit tests against handmade payloads, plus a real-Chrome
  integration test (`src/rules/target-sizing.integration.test.ts`) covering both
  viewports, because `HTMLInputElement.labels` and a real cascade cannot be
  proven by a fixture object.

- `AGENTS.md` counts and inventories had drifted from the tree: skills listed 22
  against 23 on disk (`obsidian-plugin-ui` undocumented), commands listed 27/30
  against 31 (`/ibr:ibr` undocumented). Both corrected alongside the new entries.

## [1.6.0](https://github.com/tyroneross/interface-built-right/compare/interface-built-right-v1.5.0...interface-built-right-v1.6.0) (2026-09-02)


### Features

* add --low-memory mode and universal plugin scaffold ([ccaa65c](https://github.com/tyroneross/interface-built-right/commit/ccaa65c03fdfc64a87f148711dc7901c4c8f7a6e))
* add additive Codex plugin surface ([2b05227](https://github.com/tyroneross/interface-built-right/commit/2b05227f7fba5b04f699941bc290c2d5afd7c90d))
* add auth page heuristic detection ([7694d0b](https://github.com/tyroneross/interface-built-right/commit/7694d0b132673d4a66a3768c347971bebe386b2a))
* add Browser Server mode for persistent interactive sessions ([4247a1d](https://github.com/tyroneross/interface-built-right/commit/4247a1d4c4ad95bd6fd6bf655af1990280071cc2))
* add CDP browser engine — forked from Spectra, extended for LLM-driven automation ([1a60b04](https://github.com/tyroneross/interface-built-right/commit/1a60b04e2bd4e145c45f4704d6264028f28d3a7c))
* add CLI reference skill for Claude Code / Codex ([440b062](https://github.com/tyroneross/interface-built-right/commit/440b062b6b61d50c4a22410631b2bf776a9b23ee))
* add complete UI/UX audit platform (Phases 2-4 Wave 1) ([f858111](https://github.com/tyroneross/interface-built-right/commit/f8581118ade632dcc6e07876d6263edccf3d4280))
* add component-level selector support and GitHub install config ([1850a48](https://github.com/tyroneross/interface-built-right/commit/1850a483d015ba49df60081cae43ea5618096023))
* add context-aware audit and session:press command ([2addc01](https://github.com/tyroneross/interface-built-right/commit/2addc011093abf95feb2377a8c8b773991bff4d9))
* add convenience npm scripts for common workflows ([8ce1688](https://github.com/tyroneross/interface-built-right/commit/8ce16882712025fcc12b794cca4e070413177bf0))
* add diagnostics, consistency checking, and permission controls ([e75c44e](https://github.com/tyroneross/interface-built-right/commit/e75c44e9e52287040128ccf57c00aab99a5f9fa7))
* add EngineDriver — high-level LLM-native browser automation API ([996529e](https://github.com/tyroneross/interface-built-right/commit/996529e91a6437579daa318462438a47fb53d16d))
* add interaction assertions pipeline (act→verify→screenshot) ([7eb438a](https://github.com/tyroneross/interface-built-right/commit/7eb438ac81b03196a330f2974c16942044c16ca9))
* add interactive sessions, reference upload, and IBR preference modes ([8b3f73c](https://github.com/tyroneross/interface-built-right/commit/8b3f73ca33a5d0b3adc1192fcb203d034fd449e8))
* add iterative refinement loop for automated scan-fix-verify cycles ([1d605f4](https://github.com/tyroneross/interface-built-right/commit/1d605f4a949b42c2bade5d0c4772fa5a47d70d51))
* add live session display in dashboard, port scanning, and UI improvements ([8789078](https://github.com/tyroneross/interface-built-right/commit/87890780a4531d5b0d96ec6f0127720aabfe3167))
* add LLM-native primitives — observe, extract, cache, adaptive modality ([82a3a27](https://github.com/tyroneross/interface-built-right/commit/82a3a278058da1edf9390651cbea8c1554e71278))
* add MCP server with 4 UI verification tools ([a21e912](https://github.com/tyroneross/interface-built-right/commit/a21e91283f4751048225683d2f0994f028c6972c))
* add memory system, Claude Code plugin structure, auto-gitignore (v0.4.5) ([e4f7c27](https://github.com/tyroneross/interface-built-right/commit/e4f7c27c09a24797e59a7b98281bb1abf8905f65))
* add mockup-to-reality matching pipeline (SSIM + pixelmatch) ([33acb68](https://github.com/tyroneross/interface-built-right/commit/33acb68ca4a93c074d38676f2fc5df554f261ef1))
* add native iOS/watchOS/macOS simulator validation ([f9fd3ff](https://github.com/tyroneross/interface-built-right/commit/f9fd3ff8f74f5f45f6e90ef2fc6da29c77710602))
* add Playwright compatibility adapter for incremental migration ([2b02cbb](https://github.com/tyroneross/interface-built-right/commit/2b02cbba2651167c3e0bba558fddc20cb62c9e11))
* add programmatic API, auto-cleanup, performance testing (v0.4.0) ([91105e4](https://github.com/tyroneross/interface-built-right/commit/91105e4206d85a3dfc2cd35e85e93c783b64f8c9))
* add regional diff analysis and page discovery ([87a67ed](https://github.com/tyroneross/interface-built-right/commit/87a67eda1659989eb8bdfd50f3aba3a297b5c9ca))
* add session query API, multi-viewport support, port 4242 ([9094d7b](https://github.com/tyroneross/interface-built-right/commit/9094d7b841b5dfde923151837c24238face851b9))
* add session:eval, session:modal, and improved interaction options (v0.4.1) ([2593ef8](https://github.com/tyroneross/interface-built-right/commit/2593ef85c9394d56579e120d233c583f1c1ffdbf))
* agent-driven UI testing — sessions, diagnostics, flows, Chrome fix ([d2770fb](https://github.com/tyroneross/interface-built-right/commit/d2770fb7fdcf36d55327037c8696532084d78e24))
* Apple ecosystem interactions — macOS AX actions, iOS IDB, multi-platform sessions ([97efcd7](https://github.com/tyroneross/interface-built-right/commit/97efcd768f42d2ca4544e60be6c5121930a2b6c8))
* **artifact:** add AD108 theme-contrast — defined in every state is not legible in every state ([dba663d](https://github.com/tyroneross/interface-built-right/commit/dba663de495bdcf3c591fcc75556d08ee5b6d62a))
* **artifact:** add embed-font — turn AX003 from a diagnosis into a fix ([b033327](https://github.com/tyroneross/interface-built-right/commit/b033327e8e56dd2a7b22fc1b96f27570d14ae602))
* **artifact:** add the portable artifact lane — author, check, and port self-contained HTML ([cc8de6f](https://github.com/tyroneross/interface-built-right/commit/cc8de6fdd51859314cf8b658de645f9104a75284))
* **artifact:** opt-in artifact lint on .html writes via .ibrrc.json ([34ce352](https://github.com/tyroneross/interface-built-right/commit/34ce352730507bc2889a26e5442365bcb244295a))
* **ask:** cancellation via AbortSignal + SIGINT/SIGTERM (B3) ([9fd3cb4](https://github.com/tyroneross/interface-built-right/commit/9fd3cb4f5b1c5dbf5c7a93b72141511117bd182d))
* **ask:** close v3 thesis M1 — viewport fix + docs + 10-URL eval ([0065328](https://github.com/tyroneross/interface-built-right/commit/0065328f6520ae490ac411e800c5e97f7dc3b432))
* **ask:** NDJSON streaming via askStream() and `--stream` flag (B1) ([023ebcb](https://github.com/tyroneross/interface-built-right/commit/023ebcb1a032401f8b59d80b644e4b2c44a63b4c))
* **ask:** PARTIAL verdict + iOS-guest path (Gap 3 Step 2) ([c76018f](https://github.com/tyroneross/interface-built-right/commit/c76018fa1ceacd2e4b517f36b6d6dfe899441555))
* **ask:** per-finding cropped evidence (Gap 3 Step 3) ([a18874e](https://github.com/tyroneross/interface-built-right/commit/a18874ea55c6981e787b48f984dc1a38db9871d6))
* **ask:** screenshot-as-evidence (Gap 3 Step 1) ([f44bac3](https://github.com/tyroneross/interface-built-right/commit/f44bac32af086515c74fd4ff38578ee2576ac7f0))
* **ask:** ship verdict-engine surface for v3 thesis M1 ([f0bdbc5](https://github.com/tyroneross/interface-built-right/commit/f0bdbc5e49e81d0f37b2ce1fdbb291f63c9ef21d))
* Aurora Deep web-ui redesign + feature parity with v0.8.0 ([7d76eea](https://github.com/tyroneross/interface-built-right/commit/7d76eea7326dec48402f0645138d8aa2a410a7c7))
* **cli:** add --fix-guide to native:scan command ([6e4c04a](https://github.com/tyroneross/interface-built-right/commit/6e4c04a297bc5a4f7e22bdc98ba4d3ac9ae02a5e))
* **cli:** add top-level /ibr router command ([7fbbfc7](https://github.com/tyroneross/interface-built-right/commit/7fbbfc77e06ce54907eaf84e90cb12f53d869c76))
* **cli:** cookie injection on audit/observe/extract ([1a997af](https://github.com/tyroneross/interface-built-right/commit/1a997aff6bad3db29b380863d3b64e28e3563e41))
* **cli:** ibr native:session:{start,read,action,close} --json with exit codes (E4-C) ([1a7fd7a](https://github.com/tyroneross/interface-built-right/commit/1a7fd7a6cd3e0f339d905496fe8d29ccacce5517))
* **cli:** machine-clean --json, a zoom-track command, and an agent quickstart ([427c4a0](https://github.com/tyroneross/interface-built-right/commit/427c4a02a77a5367c96085e5ae13d84253169cbf))
* **commands:** /ibr:build UI orchestrator with subordinate mode ([34cd4de](https://github.com/tyroneross/interface-built-right/commit/34cd4de29245c407e8f8f0fe73978dcacaec3be0))
* **commands:** /ibr:capture unified reference ingestion ([73299f1](https://github.com/tyroneross/interface-built-right/commit/73299f1fb107e94a26b7e7e57700fc211a8bd8d8))
* **commands:** /ibr:ui-guidance list/show/promote ([7fa5f10](https://github.com/tyroneross/interface-built-right/commit/7fa5f10cbcb03272de6e0eff342520b3630567fc))
* context optimization — slim CLAUDE.md, patience mode, auto-verify hooks, native skill ([07e0a82](https://github.com/tyroneross/interface-built-right/commit/07e0a82a984d8aefaba937d081dd74a41fd697a6))
* **dashboard:** add the dashboard lane — archetypes, record contract, event store ([e124aa3](https://github.com/tyroneross/interface-built-right/commit/e124aa32b10e9258977c768872f083b2b837a5f1))
* **dashboard:** grade dashboards — 8 measured rules, and --check that cannot lie ([e733da2](https://github.com/tyroneross/interface-built-right/commit/e733da2f61f95dc05dd5d0e632235f508ac514b5))
* design system checks in all scan paths ([67c1247](https://github.com/tyroneross/interface-built-right/commit/67c1247226a1f8c07276ca6e6bf8e9b9ceee1686))
* design system extension (v0.8.0) — Calm Precision enforcement, tokens, patterns ([80653a6](https://github.com/tyroneross/interface-built-right/commit/80653a607915a958a222c50da1c3d780c1343293))
* **engine:** add destructive-label guard to tier-4 auto-resolve ([f17acb3](https://github.com/tyroneross/interface-built-right/commit/f17acb3d1ff3c1b6e808333941dae6f39b18ba4c))
* **engine:** iframe element driving + JS dialog handling (E3-D) ([518460c](https://github.com/tyroneross/interface-built-right/commit/518460c0773491c65d48bfdd35ae4630d6e129ac))
* **engine:** per-action auto-wait + actionability in click/type/fill/check/select (E3-A) ([4181a9d](https://github.com/tyroneross/interface-built-right/commit/4181a9d01d5231b50659d335c122bdf303d7966a))
* **engine:** real CDP network awareness — networkidle + waitForResponse (E3-B) ([68fe246](https://github.com/tyroneross/interface-built-right/commit/68fe24674f76a795de2b7e0270c6704d3c248d2a))
* **engine:** warm BrowserPool — drops second-call ask latency ~50% (Gap 2) ([3196ed6](https://github.com/tyroneross/interface-built-right/commit/3196ed6a99f678b97a6563e76ca8fb21d04ea31e))
* expose interaction engine via MCP tools and CLI ([c3be5aa](https://github.com/tyroneross/interface-built-right/commit/c3be5aaab5749c47aa756d7d5561d6e0c7119ae0))
* **extract:** opt-in content elements and &lt;head&gt; metadata ([1588960](https://github.com/tyroneross/interface-built-right/commit/158896040245c8f30bef697e41e71d0886bb12a0))
* fix-guide docs in CLAUDE.md, align CLI version to 0.7.0 ([3ada7b1](https://github.com/tyroneross/interface-built-right/commit/3ada7b16e329869b607814f925338065230d3deb))
* **flow_search:** open ⌘K command palette before giving up ([93fba54](https://github.com/tyroneross/interface-built-right/commit/93fba5417af1295003a165f1fa980e1abb7221a5))
* interface-built-right v1.0.0 - Visual regression testing for Claude Code ([ca4984c](https://github.com/tyroneross/interface-built-right/commit/ca4984c4495602c64ff2b290954d8cfa6aba309d))
* **live:** measure a responsive rule at the width it fires at, and grade a mixed colour ([6731ebd](https://github.com/tyroneross/interface-built-right/commit/6731ebd8a9c328399f3d75aac09171aeb97cf43a))
* **live:** measure a running app's pane over CDP without mutating it ([6134277](https://github.com/tyroneross/interface-built-right/commit/613427796426bb7bf94f2f91339d92bab8df6df6))
* **macos:** --analyze-layout in Swift extractor + drop-in Swift templates ([a869976](https://github.com/tyroneross/interface-built-right/commit/a869976da0f7ec205e07783f295165c24b182919))
* **macos:** native layout-fill / gap analyzer + scanMacOS wiring ([b91a4e5](https://github.com/tyroneross/interface-built-right/commit/b91a4e5a5780729d791679f92d11e9f9be03ca7e))
* **mcp:** add a session idle sweep, implemented always and disabled by default ([69a5028](https://github.com/tyroneross/interface-built-right/commit/69a502808cd4071eb9bb052d661dd96b18ec035b))
* **mcp:** expose keystroke/app/menuPath action enums, thin adapters (E4-B) ([b51896a](https://github.com/tyroneross/interface-built-right/commit/b51896ab66c4c4cf23d90c688496c498ff1ec960))
* **mcp:** register `ask` tool — verdict-engine over MCP (B2) ([4777d5f](https://github.com/tyroneross/interface-built-right/commit/4777d5fd8a9ff673a0715232fb8427564e7e25cd))
* **mcp:** rule engine + summaries in scan response, 8 rule tests ([9d5e4e0](https://github.com/tyroneross/interface-built-right/commit/9d5e4e080d9f92b9b86194ff308469610d508cc2))
* **mcp:** verify-then-proceed web actions — validator + evidence, no fake success (E3-E) ([2870ca3](https://github.com/tyroneross/interface-built-right/commit/2870ca365ff64704b72db5b887ff1171a78d9c0d))
* **mockup-gallery:** read ratings and selections safely ([c206965](https://github.com/tyroneross/interface-built-right/commit/c2069657fb5eb382329f613b2712956181b83e9c))
* **mockup-gallery:** record implementation completion ([3a1cfbb](https://github.com/tyroneross/interface-built-right/commit/3a1cfbb47cac0187558736d963ae85826abbc37e))
* **mockups:** add dashboard scan experiments ([7027a3c](https://github.com/tyroneross/interface-built-right/commit/7027a3c39fda4624c6cd02527f8edac823036329))
* **native:** add cursor-free AX sessions ([a2c1ab0](https://github.com/tyroneross/interface-built-right/commit/a2c1ab012fe07dbdf5fff8c3044abc0aab05cfbc))
* **native:** add fix guide generator ([5334da9](https://github.com/tyroneross/interface-built-right/commit/5334da9acbbf27128165373276244a3427a794e0))
* **native:** add opt-in `drag` verb for split/inspector dividers (gated pointer injection) ([fd9118b](https://github.com/tyroneross/interface-built-right/commit/fd9118bfb2c0f82b5071be81f53cdb212b0d4e25))
* **native:** add SoM screenshot annotator ([8b4f8ac](https://github.com/tyroneross/interface-built-right/commit/8b4f8ac4e1b74a2eb3d9fad95ef32bcb702c8d6b))
* **native:** app lifecycle launch/switch/quit (E2-C) ([2d39f3f](https://github.com/tyroneross/interface-built-right/commit/2d39f3f59293b3df4c0405724b947c2da120961c))
* **native:** AXMenu traversal after AXShowMenu (E2-D) ([91b4cc9](https://github.com/tyroneross/interface-built-right/commit/91b4cc94627fd422ccaf62913d73d016e0ec69f0))
* **native:** macOS keyboard synthesis to arbitrary apps (E2-B) ([ca8a380](https://github.com/tyroneross/interface-built-right/commit/ca8a380309b4a3c4c70ba7d92738fa898c14967f))
* **native:** persistent Swift AX daemon + resolved-path cache, opt-in (E2-A) ([50bc8d7](https://github.com/tyroneross/interface-built-right/commit/50bc8d7c9aa1fc16dc92f07cc29b3edcd7577493))
* **obsidian:** load Obsidian's real app.css and detect layout overflow ([826787b](https://github.com/tyroneross/interface-built-right/commit/826787b02a4e5c1cc11a674c1e4a931f505c7421))
* **obsidian:** scan_obsidian — mount an Obsidian plugin view in a real browser ([1c43a5b](https://github.com/tyroneross/interface-built-right/commit/1c43a5b5822bdef3fece985169c681c5f1c02d14))
* Phase 4 — design change capture and verification system ([f9efd49](https://github.com/tyroneross/interface-built-right/commit/f9efd4918d523a3a745eaeafdcf3bc9ab7bbb0f1))
* Phase 5 — test generation, execution, script runner, iterate loop ([0fb96d3](https://github.com/tyroneross/interface-built-right/commit/0fb96d3a63f108893054dbec3feed5d05c216344))
* **phase-6:** AX tree reliability layer — shadow DOM piercing + coverage reporting ([e1353ae](https://github.com/tyroneross/interface-built-right/commit/e1353ae5b1446220c7c6a26dc74a20e5daf844b5))
* **phase-7:** Safari browser support via safaridriver + macOS AX API ([f199e18](https://github.com/tyroneross/interface-built-right/commit/f199e18dc5501a57b425447bbdd8b60c1c3609a8))
* **plugin:** route feedback to GitHub Issues, drop the inbox ([bf73260](https://github.com/tyroneross/interface-built-right/commit/bf732601ef0c18ffb3ad99356d33675456f32ad5))
* remove Playwright dependency — IBR now runs on pure CDP ([ee52ccc](https://github.com/tyroneross/interface-built-right/commit/ee52ccc119a1287244ce82e43131162fb8cf639c))
* remove Playwright dependency, add flow test commands ([6ad229c](https://github.com/tyroneross/interface-built-right/commit/6ad229c904a259f31517998462b14c0968471fd5))
* rename slash commands to /ibr-* convention ([fe87252](https://github.com/tyroneross/interface-built-right/commit/fe87252ef17b692357f587877a93b3e445fbcaf8))
* **rules:** skip layout-collapsed elements in minimal preset ([2d39d0f](https://github.com/tyroneross/interface-built-right/commit/2d39d0f7041c2ebcf426325b0e452aef6b34f33e))
* **rules:** skip popup triggers + form-submit buttons in minimal preset ([1c4e5d8](https://github.com/tyroneross/interface-built-right/commit/1c4e5d848aa48f9e7a6b3c47cf783d82a3806ece))
* **scan,session:** add --device flag for canonical device profiles ([361f097](https://github.com/tyroneross/interface-built-right/commit/361f097842451760169f7932e8c11e43ed8d5be2))
* **scan:** extract structural elements for typography + hierarchy sensors ([5d2796c](https://github.com/tyroneross/interface-built-right/commit/5d2796c3dded90faf9ac9f0089e65a74c91422c6))
* **scan:** wire 5 new sensors into runSensors + scan pipeline; bump 1.1.1 -&gt; 1.2.0 ([bf95034](https://github.com/tyroneross/interface-built-right/commit/bf95034ddc3517147ee9afa8bbc9cb9ce3b7baf7))
* screenshot capture, design tokens, static scan, source bridge ([aa1cbd0](https://github.com/tyroneross/interface-built-right/commit/aa1cbd073d90860cb5cd8cf8d74c4ce14eb72682))
* **sensors:** add typography, breakpoints, motion, hierarchy, interaction-states (+33 tests) ([68140c6](https://github.com/tyroneross/interface-built-right/commit/68140c60e13fb4336fc829a9f625adff47956a6f))
* **sensors:** extend SensorContext with cssRules + documentMeta (additive) ([1222c31](https://github.com/tyroneross/interface-built-right/commit/1222c310855e8e2c700b0a7693a0f621612fee90))
* session creation without URL, no default rule presets ([9f1f6b0](https://github.com/tyroneross/interface-built-right/commit/9f1f6b04827de1c858c7cd8fee02922ec36811a2))
* **session:** add session:select for native &lt;select&gt; elements ([9dedd92](https://github.com/tyroneross/interface-built-right/commit/9dedd924313b30cfe592a25f4a37351b671cec6c))
* **sim-driver:** iOS logical points by default; --coords flag (D1) ([c026da8](https://github.com/tyroneross/interface-built-right/commit/c026da85df3467b734307344b0d8d47edd6292bc))
* **skills:** ios-ui with HIG + FloDoro/SpeakSavvy lessons + Apple doc links ([6064eb5](https://github.com/tyroneross/interface-built-right/commit/6064eb54f745953f93fbdbc918d940f1f6eea23a))
* **skills:** macos-ui with HIG + notarization + distribution ([2a101a5](https://github.com/tyroneross/interface-built-right/commit/2a101a53ccb3eb4111df0075d055b8e2acb9d027))
* **skills:** mobile-web-ui with Material 3 + WCAG 2.2 + iOS Safari ([c29bed4](https://github.com/tyroneross/interface-built-right/commit/c29bed4603e89b4bc386e6dc839aa89ec0a5e3f3))
* **skills:** mockup-gallery-bridge ([3f57443](https://github.com/tyroneross/interface-built-right/commit/3f57443a0944d507c7d93ad8c6e0a03b8e3e92a6))
* **skills:** ui-brainstorm-preamble hybrid layer-1 ([03e0d77](https://github.com/tyroneross/interface-built-right/commit/03e0d77ea7486829002fbb163472279455345f58))
* **skills:** ui-guidance-library ([c5afc7e](https://github.com/tyroneross/interface-built-right/commit/c5afc7edc46f1de8654f5e35bf9a80445cbab97a))
* slash commands now prompt user for URL input ([1e56c27](https://github.com/tyroneross/interface-built-right/commit/1e56c2724a35330b6d4cf1c725062edfc362a2c1))
* smart port detection for init command ([9d57460](https://github.com/tyroneross/interface-built-right/commit/9d574603f65f7b0e6b97695c01f9879c03413e93))
* theme mismatch detection + layout collision detector ([0ceab09](https://github.com/tyroneross/interface-built-right/commit/0ceab09b6a44021a110af9bdc6333029db49d58a))
* **ui-brainstorm-preamble:** route to platform-specific skills ([f9f6068](https://github.com/tyroneross/interface-built-right/commit/f9f6068f1d13229995f60362fb49bfda1cec195f))
* **ui-guidance:** index central + project-local templates ([b9e1c48](https://github.com/tyroneross/interface-built-right/commit/b9e1c48f236a78739b037dc68a9bb297f5ca1b21))
* **ui-guidance:** promote project draft to central library with confirm gate ([8e07e62](https://github.com/tyroneross/interface-built-right/commit/8e07e6277128911b1d977ee327c87ed6d1d2373d))
* **ui-guidance:** snapshot template to project active.md ([5190bac](https://github.com/tyroneross/interface-built-right/commit/5190bacc018a560f414f8480947622bc3bbf9da7))
* **v0.10.0-alpha:** end-to-end design tool with two-tier architecture ([ff28b73](https://github.com/tyroneross/interface-built-right/commit/ff28b73080a7ecaa7ac1af49cc5b9ddaa08d0305))
* v0.2.2 - auto-detect dev server, zero-config workflow ([cd165b3](https://github.com/tyroneross/interface-built-right/commit/cd165b3ab1bdee2bea40ccb4af79095bd105ace3))
* v0.2.3 - auto-visible element targeting + form submit improvements ([5b0bf7b](https://github.com/tyroneross/interface-built-right/commit/5b0bf7b35f7a0f25bf29cd3efd19cd8c908945ed))
* Wave 2-3 complete - integration checks and session paths ([3c481e1](https://github.com/tyroneross/interface-built-right/commit/3c481e1a01c4b01c0e764d6cebcf69067994f37f))
* **web-ui:** improve image display with placeholders and expand modal ([52a7046](https://github.com/tyroneross/interface-built-right/commit/52a7046d1a03ff81b969672a97f84c372968ac2c))
* **web-ui:** stream CLI output via spawn + extractJson, add ScanSummary ([f5d72ea](https://github.com/tyroneross/interface-built-right/commit/f5d72ea5e0294c3d884edc06bbbb4561d588b949))
* **zoom-track:** carry text and resolved colours, and rank targets by importance ([c71cdd4](https://github.com/tyroneross/interface-built-right/commit/c71cdd4af9f8195ecffa9cecc954c2d2aa7cde77))
* **zoom-track:** headings as targets, ranked by level; scan --content on the CLI ([97cb2ea](https://github.com/tyroneross/interface-built-right/commit/97cb2ea8a529ac2255af323da8758388a613d9fd))
* **zoom-track:** reach the whole page via scrollY, and accept real event times ([0e24a32](https://github.com/tyroneross/interface-built-right/commit/0e24a328bf6e6c5852df5617124a93350c952a0f))


### Bug Fixes

* **.codex-plugin/mcp.json:** wrap server under mcpServers key for Codex loader ([1429378](https://github.com/tyroneross/interface-built-right/commit/14293789968255917bb25753276211d5a839b185))
* address code review findings (critical + important) ([db2118d](https://github.com/tyroneross/interface-built-right/commit/db2118d68aeca934036ab1cd05e7cfe22143c101))
* address code review findings + add 52 tests ([8c83906](https://github.com/tyroneross/interface-built-right/commit/8c83906e6ef0b135f55ba9eadf48d5d0c95e4f86))
* address user feedback - shebang, auth, serve, docs ([cc45233](https://github.com/tyroneross/interface-built-right/commit/cc452333ee872df6fba160376f0506dfa9d2f6bf))
* **artifact:** calibrate lint heuristics against 476 real pages — 2311 findings to 1659 ([43dd704](https://github.com/tyroneross/interface-built-right/commit/43dd704e5765e67975ab0c1760f40687c6ccdf9b))
* **ask:** forward auth cookies through ask() to scan() (auditor f2) ([d9afc9e](https://github.com/tyroneross/interface-built-right/commit/d9afc9e58be31a7a334cf09027502414a5180d6b))
* audit __name error + use built dist for npm scripts ([504014c](https://github.com/tyroneross/interface-built-right/commit/504014c864634c5fbf1fe2ea0f552b619bc4ff97))
* **browser:** reap abandoned IBR Chrome sessions ([2672ec4](https://github.com/tyroneross/interface-built-right/commit/2672ec47374bc81171a56b626762bb2c727a06d1))
* build CLI as CJS for shebang compatibility ([c5b98e4](https://github.com/tyroneross/interface-built-right/commit/c5b98e4e28c5ed5999f6c291ae07778fb7556ac0))
* capture initial screenshot for live sessions ([0bc6049](https://github.com/tyroneross/interface-built-right/commit/0bc6049e109432c499a050eda25f6217405ac0f1))
* catch SecurityError when reading httpOnly cookies ([8ad6953](https://github.com/tyroneross/interface-built-right/commit/8ad69534bc7153ee3b3fac276abc65f752b573c6))
* **cdp:** detect SingletonLock symlink via lstat to avoid stale-lock launch ([59f7b2f](https://github.com/tyroneross/interface-built-right/commit/59f7b2f64de856f315e3cc6b7380227edc3dc7f8))
* Chrome debugger timeout after many sessions ([d363adb](https://github.com/tyroneross/interface-built-right/commit/d363adbf2cab9fea8ab6307a88b7f9b5dad53dda))
* **ci:** green the two new v1.5 hardening gates ([a99e731](https://github.com/tyroneross/interface-built-right/commit/a99e7319754875c49a2b3e9c1ce42967c2523259))
* **cli+docs:** remove -o/-v inline commander defaults; correct allowedDiffPercent verdict-boundary doc ([9f5f9fe](https://github.com/tyroneross/interface-built-right/commit/9f5f9fe841fbe5c33d953a03d93e245d95e0685d))
* **cli:** audit --visual honors the -t verdict tolerance flag ([8895455](https://github.com/tyroneross/interface-built-right/commit/8895455ae47aa67de6e87a4115666bb4d91f9c92))
* **cli:** audit baseline lookups read the real -o flag, not the never-set globalOpts.outputDir ([a59758d](https://github.com/tyroneross/interface-built-right/commit/a59758d6596bd313452de5a73972aeea2273fc9c))
* **cli:** config-file threshold no longer clobbered by the -t commander default; harden magic-number guard ([3484803](https://github.com/tyroneross/interface-built-right/commit/348480336f675c67599fcf6bedde73e31553d086))
* **cli:** make the documented first run actually run ([ac6263a](https://github.com/tyroneross/interface-built-right/commit/ac6263a4e5ac1a422ef2871f6638711a999b6460))
* **compare:** close D3 on the ibr native:check CLI path; tighten allowedDiffPercent doc ([bb2a1de](https://github.com/tyroneross/interface-built-right/commit/bb2a1de4fc43cf33bb48623fd82f06682f6575aa))
* **compare:** explicit tolerance wins over a structured policy override; harden threshold merge ([a5a4e50](https://github.com/tyroneross/interface-built-right/commit/a5a4e50eabdf0998af5ca6b1e04a8d272834ad09))
* **compare:** separate verdict tolerance from pixel sensitivity; count green diffs; native region semantics ([32e9cdd](https://github.com/tyroneross/interface-built-right/commit/32e9cddb4d51aea50668c63531b6acd26102ae80))
* complete plugin restructure — restore hooks/skills, remove plugin/ dir ([6441538](https://github.com/tyroneross/interface-built-right/commit/6441538cd07bdc293d081eb2ed1d8e0f48662cad))
* complete version bump to 0.8.0 and export design system API ([de6188f](https://github.com/tyroneross/interface-built-right/commit/de6188ff3a115ef41406012b31bd5c4d2eac786e))
* **contrast:** parse modern CSS colors so a Tailwind v4 page is actually measured ([df1b1d3](https://github.com/tyroneross/interface-built-right/commit/df1b1d3614d50f412afcbf08f0fa284970e00cac))
* count assertion works without visible companion ([06e9d1e](https://github.com/tyroneross/interface-built-right/commit/06e9d1e201fb7d0ac30d0272e7451e7d44f2b4b7))
* CSS property key mismatch — support both camelCase and kebab-case ([1028110](https://github.com/tyroneross/interface-built-right/commit/10281106c1aa40960c7238d7ad9643175cafa6ca))
* dedup issues, filter simulator chrome, fix label suggestions ([0ff67c1](https://github.com/tyroneross/interface-built-right/commit/0ff67c1c81db8b6e28ee23ac47e02a191344c11a))
* **dist:** make the shipped CLI and MCP server runnable without node_modules ([ea7d148](https://github.com/tyroneross/interface-built-right/commit/ea7d14819845eecb938cc4f9969edec3d7033021))
* **engine, mcp:** close concurrency races + hang risk in BrowserPool ([ed6e8a4](https://github.com/tyroneross/interface-built-right/commit/ed6e8a490c959f53f19398579ae542aa755d4b71))
* **engine:** bound every connect and spawn path, and say what it waited on ([1eba66e](https://github.com/tyroneross/interface-built-right/commit/1eba66e26b8e21ef2fb50468482818d756e6efe2))
* **engine:** pressKey synthesizes real modifier chords (E3-C1, mutation-first) ([db35b13](https://github.com/tyroneross/interface-built-right/commit/db35b13fb6a9a0bc5703c0da2fb58439ec65746d))
* **f1:** pre-filter tier-4 scored pool by options.role to prevent wrong-role auto-resolve ([ab7d3d5](https://github.com/tyroneross/interface-built-right/commit/ab7d3d58acc51a8210097058e3c92ea65f8dbd74))
* **f4,f5:** apply chrome warning in readSimulatorSession; lowercase normalizeReadMode ([5071a25](https://github.com/tyroneross/interface-built-right/commit/5071a25199408615857ba6f18853034b156778f7))
* **flows:** replace `:has-text(...)` Playwright pseudo with native DOM walk ([6657417](https://github.com/tyroneross/interface-built-right/commit/66574174cfe44ebc159a957f108ec473f14ff9f9))
* hide Safari window during testing ([6813d25](https://github.com/tyroneross/interface-built-right/commit/6813d25885a13a221e5a66103bc1ec45e5738fa6))
* include dist/ in git for GitHub installs + add onboarding ([c1243bf](https://github.com/tyroneross/interface-built-right/commit/c1243bfd35d5781be2d92ea5585bf6e8db1e372e))
* **install:** update marketplace.json and README for external users ([d3c335a](https://github.com/tyroneross/interface-built-right/commit/d3c335a07a746e01e8fd56d4ff1fd01c3fd15c41))
* integration checker now detects Next.js App Router routes ([4a11af4](https://github.com/tyroneross/interface-built-right/commit/4a11af4c44330f01db4d2f9cdf56576fa4cb85ff))
* **interactivity:** detect handlers set as properties, not just attributes ([b404e14](https://github.com/tyroneross/interface-built-right/commit/b404e149f24a13409087aea0016b5f4d651177c4))
* isolate test Chrome profiles to prevent concurrent lock conflicts ([13c6757](https://github.com/tyroneross/interface-built-right/commit/13c6757f112baa241ae42a71799938c134fb83b4))
* **lifecycle:** reap orphan Chrome + handle SIGHUP/exit in session:start ([#4](https://github.com/tyroneross/interface-built-right/issues/4)) ([ed195d3](https://github.com/tyroneross/interface-built-right/commit/ed195d39ea18cab1141b96b5f6cd51be068c3fb2))
* **mcp:** close sessions at shutdown, and reuse the warm pool for screenshots ([de842d3](https://github.com/tyroneross/interface-built-right/commit/de842d392e7c89001b2609248112c0b0418064ad))
* **mcp:** flow_form/flow_login honor sessionId, no relaunch (E3-C2, mutation-first) ([8cec062](https://github.com/tyroneross/interface-built-right/commit/8cec0620a2c850c517e867b1d296753dbc938d28))
* **mcp:** guard handleAsk against empty session cookies (auditor f2-A) ([72a5da3](https://github.com/tyroneross/interface-built-right/commit/72a5da3374cacecd8936135cbe2692bb62923973))
* **mcp:** scroll validator + CLI shared validateWebAction (auditor f7/f8, Iterate) ([6332f91](https://github.com/tyroneross/interface-built-right/commit/6332f91b9201823a06aab97a3a836c87508fa00e))
* **native:** auditor findings f6/f4/f2/f1 — NUL byte, test-safety, honesty (Iterate) ([4c60fa6](https://github.com/tyroneross/interface-built-right/commit/4c60fa61f04a8c71e8b1b17a065ee3814c260a2a))
* **native:** make `drag` self-activation reliable right after app launch ([c851085](https://github.com/tyroneross/interface-built-right/commit/c851085371cdd8d14e15651bc233afce707b5ac5))
* **native:** make `select` verb select SwiftUI List rows (AXSelected + row climb) ([e33922a](https://github.com/tyroneross/interface-built-right/commit/e33922ad228aba4cbe6377d5a75323a0bb95a0f5))
* **native:** repair stripped PATH so scan_macos finds swift/xcrun (ENOENT) ([aa73be3](https://github.com/tyroneross/interface-built-right/commit/aa73be3076e1cf1131ed5cfc77def980cf3f57e0))
* **native:** resolve macOS apps without pgrep ([51cd9cb](https://github.com/tyroneross/interface-built-right/commit/51cd9cb65c9fb100c6efa0bc2eb262b846b7c93e))
* **native:** stabilize AX session navigation ([3e9375a](https://github.com/tyroneross/interface-built-right/commit/3e9375a346d721f89bddc15278d9139f1b92cb6f))
* **native:** support pid-targeted native sessions ([47c6e02](https://github.com/tyroneross/interface-built-right/commit/47c6e02fac6b01e70a497209d74f52b1fc6f26dc))
* **obsidian:** await the view lifecycle before marking the mount ok ([a75a5a9](https://github.com/tyroneross/interface-built-right/commit/a75a5a921048d902e1d01252be171e02bf2fe559))
* **obsidian:** hand the view the contentEl the harness already built ([4205171](https://github.com/tyroneross/interface-built-right/commit/4205171487d7c2b5d924d6ce3850b5fc7bae4558))
* **obsidian:** sanitizeHTMLToDom actually sanitizes (no innerHTML sink) ([3aee21e](https://github.com/tyroneross/interface-built-right/commit/3aee21e1eac7df8bf1311415c2d9611dc3af9f6e))
* **obsidian:** stop reporting clipped descendants as layout collisions ([814a046](https://github.com/tyroneross/interface-built-right/commit/814a0461b41b99c57e8ae9870bf1a6f3ff408a21))
* **obsidian:** stop the test suite grading itself on what is installed ([d06d1c7](https://github.com/tyroneross/interface-built-right/commit/d06d1c7db894df2d0df4f794af47bedd7557354b))
* P0 session resilience and visibility waiting ([1d154c2](https://github.com/tyroneross/interface-built-right/commit/1d154c2de640454921b4281b695df55fb742dd8d))
* **R1:** session_action auto-resolves unambiguous fuzzy matches ([fc510ab](https://github.com/tyroneross/interface-built-right/commit/fc510aba6c71244a023fcf680cf2ac64ba9bb2e4))
* **R2:** session_read defaults `what` to observe instead of erroring ([51a838c](https://github.com/tyroneross/interface-built-right/commit/51a838c04a2a35922831225c189b9c7194d762b3))
* **R3:** scan threads session auth + suppresses zero-confidence intent noise ([860c0d4](https://github.com/tyroneross/interface-built-right/commit/860c0d4c6cd10be0b89db5770cf98915c8fb4609))
* **R4:** sim_action reads the iOS app subtree, not Simulator chrome ([d81aa4c](https://github.com/tyroneross/interface-built-right/commit/d81aa4c44940444fd525fb0e63af3fe9a04efa1c))
* **R5:** native env preflight returns one-line fixes instead of tracebacks ([65275a6](https://github.com/tyroneross/interface-built-right/commit/65275a64c8e6797d288f8d63c468ccb017403457))
* **release:** harden v1.5 package gates ([acd6ff0](https://github.com/tyroneross/interface-built-right/commit/acd6ff0e8786600bea45207e5883133b2986554d))
* **release:** unblock validate:release, and test the dormancy we actually ship ([f457f64](https://github.com/tyroneross/interface-built-right/commit/f457f645dcc356134d15fe0bc7a135858c1a74b7))
* remove duplicate manifest path references and fix .mcp.json shape ([7409cda](https://github.com/tyroneross/interface-built-right/commit/7409cda94a6f4a38c680040caca21a83d9bb8541))
* replace Playwright :has-text() with standard JS in page-intent evaluate block ([8739347](https://github.com/tyroneross/interface-built-right/commit/873934782ae673d7e71397e4b796ca844fc51c1f))
* research-driven improvements — IDB fallbacks, screenshot fallback, verify, compression, analysis ([42ceb6c](https://github.com/tyroneross/interface-built-right/commit/42ceb6c23a3beb96f99ad1e957161af41284a265))
* resolve 3 Codex review findings for design system scan paths ([bb63729](https://github.com/tyroneross/interface-built-right/commit/bb63729bcfe222b73e53debb6a03ce49ae3f6710))
* resolve all 76 DTS type errors — build now clean ([dfc42bd](https://github.com/tyroneross/interface-built-right/commit/dfc42bddaaea008c0011bf1876b1f4eb64863b7e))
* resolve remaining 76 TypeScript DTS build errors ([087cf7f](https://github.com/tyroneross/interface-built-right/commit/087cf7f8f815c1d1b397b277f8c8c1c0a62cb8fe))
* **resolver:** prefer exact label over low-confidence fuzzy matches ([fa0da8f](https://github.com/tyroneross/interface-built-right/commit/fa0da8f8afbc3a855a0530cd424ebb2f7a6eb02b))
* **router:** point /ibr router and preserved commands at surviving surfaces ([d4f1c84](https://github.com/tyroneross/interface-built-right/commit/d4f1c84a88f4232e0cbaa6f68280dbf5dad6f9cb))
* **rules:** stop fake-interactive from flagging natively interactive elements ([5d3580a](https://github.com/tyroneross/interface-built-right/commit/5d3580a0409d8faa3aad5bb80cb034b4ab1f0208))
* **rules:** stop grading disabled controls, which WCAG exempts ([6c482a8](https://github.com/tyroneross/interface-built-right/commit/6c482a845ce11bba7774f01c5fb9c52b72108d91))
* **scan:** detect persistent skeleton state in headless scans ([c8c429a](https://github.com/tyroneross/interface-built-right/commit/c8c429aa9352f77fbcbb6f18cc7759d51ad68c73))
* **scan:** honor --viewport mobile|tablet|desktop via CDP setDeviceMetricsOverride ([707a276](https://github.com/tyroneross/interface-built-right/commit/707a2765cdcc59a6670e68ebd70bbb9a1f3d2ec6))
* **scan:** read --viewport from both subcommand and global option scopes ([3ed62b8](https://github.com/tyroneross/interface-built-right/commit/3ed62b8b8fd1d6e1c0bc814e028a0463df7fcaef))
* **security:** clear pooled driver's cookies before each scan (cross-scan auth leak) ([58b11f4](https://github.com/tyroneross/interface-built-right/commit/58b11f430fb7dbac30d469be71c69dafa159c15f))
* **semantic:** read rendered text, not innerText, when detecting error state ([cce62e5](https://github.com/tyroneross/interface-built-right/commit/cce62e57bb112a682b35bddf27ff4c6f32d2cd66))
* **session_action:** support page/window scroll without an element target ([bfe8dbe](https://github.com/tyroneross/interface-built-right/commit/bfe8dbe177f63d0b2d8c83c1cccdad3b8fc6077c))
* session:type command not persisting across CLI calls ([32fbf05](https://github.com/tyroneross/interface-built-right/commit/32fbf05d3efbb408827e373837e827780564447d))
* **session:** close per-command tab to prevent tab leak ([aa8c9d1](https://github.com/tyroneross/interface-built-right/commit/aa8c9d147f0b2d6fd6ccbb7324d691af06769504))
* **session:** exit cleanly after session:* commands so automation doesn't hang ([2d70646](https://github.com/tyroneross/interface-built-right/commit/2d7064637dba80603accc917be5521bfea399815))
* **session:** stop leaving stale manifests, and say plainly when the CLI blocks ([a4306a4](https://github.com/tyroneross/interface-built-right/commit/a4306a461d7c7fb3f1c66d7a561fe82e453513e6))
* **skills:** front-load trigger and boundary in skill descriptions ([99c2885](https://github.com/tyroneross/interface-built-right/commit/99c2885d932689d07e87c55b6783e6e10734c506))
* **test:** replace stale ~/Desktop fixture path with repo-local fixture-templates ([15ee79a](https://github.com/tyroneross/interface-built-right/commit/15ee79a6a07cab178247255963db5c1f95c6474f))
* **tests,ci:** repair 23 tsc test-fixture errors + add typecheck CI gate ([f4107ee](https://github.com/tyroneross/interface-built-right/commit/f4107eebcf72f31b05cbc6317ca5bb5b19a9a238))
* **touch-targets:** exclude non-visible elements from the audit ([3c0eb6e](https://github.com/tyroneross/interface-built-right/commit/3c0eb6e342a96a5c0c733d4fc343ae2ef9fd4c31))
* **types:** read sibling sources via __dirname, not import.meta (TS1470) ([9cb21de](https://github.com/tyroneross/interface-built-right/commit/9cb21de425839b656c99d3f9e4d712a6b140100d))
* update CLI to use EngineDriver instead of BrowserServer ([a5b7948](https://github.com/tyroneross/interface-built-right/commit/a5b79486c763a79853e9917a2c2acceba311713f))
* update package.json files to match plugin restructure ([078bff2](https://github.com/tyroneross/interface-built-right/commit/078bff24f7007088662e5fde4c6d7a6f2179c838))
* update PageLike interface and inline types for full compatibility ([bbff439](https://github.com/tyroneross/interface-built-right/commit/bbff439f14229e3d9125ab69874630c59a7c7685))
* update plugin to follow Claude Code best practices ([e8444dc](https://github.com/tyroneross/interface-built-right/commit/e8444dc4187ef0ed4788ca55ebbf4f3a8d966a0f))
* use correct hook response format (ok/reason instead of decision) ([034e1db](https://github.com/tyroneross/interface-built-right/commit/034e1db00e519aed06cc1d72c2e453d4c9dd8e60))
* use port 5000 as default, auto-detect fallback if in use ([b9d9029](https://github.com/tyroneross/interface-built-right/commit/b9d90294c0dfa0c472e1b3f31d0536e5f0da8bf1))
* **version:** sync CLI and MCP server version strings to 1.0.0 ([9d5cb19](https://github.com/tyroneross/interface-built-right/commit/9d5cb19a88af4c32b35278592742e079ea113ffc))
* **web-ui:** a11y + contrast — clear dashboard scan FAIL findings ([2511b60](https://github.com/tyroneross/interface-built-right/commit/2511b600bc9a6df9bdd5c7d03a48e27cb9dbb015))
* **web-ui:** bind the dashboard to loopback, and correct a wrong nosec rationale ([e9d83b4](https://github.com/tyroneross/interface-built-right/commit/e9d83b4036c65f0bbe639bd1380a493946ae59d5))
* **web-ui:** derive the muted text colour instead of picking one ([ce77e27](https://github.com/tyroneross/interface-built-right/commit/ce77e27ec9a9b3c285f8d6d95f0cf2aec00870e3))
* **web-ui:** portable .ibr resolution + kill command injection in API routes ([97d9378](https://github.com/tyroneross/interface-built-right/commit/97d93783398e6704aec53967f487acfab3d744ff))
* **zoom-track:** drop off-screen targets instead of aiming outside the frame ([e85d540](https://github.com/tyroneross/interface-built-right/commit/e85d54025d62a89f03c0fc502759306b5f07576c))


### Performance Improvements

* **session:** batch the per-start hard-wall scan; document the blocking start ([04b86a4](https://github.com/tyroneross/interface-built-right/commit/04b86a4ea4cfd2a2db715ed45caef2177d51c952))

## [1.5.0] — 2026-07-06 — Increment 1: native session API/MCP/CLI parity + driving foundation

**Version bumped to `1.5.0` in `package.json`; awaiting release cut.** The git tag
and GitHub Release (which trigger `npm publish` via `publish-npm.yml`) have NOT been
created yet — the maintainer cuts those. Semver note: `1.5.0` (minor) is a pragmatic
choice given the MCP consumers are LLM agents reading text; the `interact` /
`session_action` `success`-semantics change (now a real validator, not always-true)
is the one technically-breaking behavior — see **Behavior changes** — and would be
`2.0.0` under strict semver.

### Added

- **Native session controller API** — `NativeSessionController`
  (`src/native/session-controller.ts`), exported from the package root, is now
  the canonical implementation for native (macOS AX / iOS-watchOS simulator)
  session start/read/action/close. `native_session_*` MCP tools and the new
  CLI both delegate to it, so all three surfaces behave identically. See
  `docs/native-session-cli-reference.md` for one example per surface.
- **CLI parity** — `ibr native:session:{start,read,action,close}`, with
  `--json` output and non-zero exit codes for failed actions, missing
  sessions, failed waits, and invalid targets. Session state persists
  cross-process to `.ibr/native-sessions/<sessionId>.json` (each CLI
  invocation is a separate OS process). Full flag/exit-code reference:
  `docs/native-session-cli-reference.md`.
- **`native_session_action` capability kinds** — the MCP action enum gains
  `keystroke`, `app`, and `menuPath`, additive over the existing element verbs
  (`click`, `press`, `fill`, `type`, `focus`, `showMenu`, `increment`,
  `decrement`, `confirm`, `cancel`, `scroll`, `scrollToVisible`, `check`,
  `select` — all unchanged). `target` is optional for the three new kinds,
  required for element verbs (enforced in the handler, not just the schema).
  All three are now **live** — every backend returns a real, validated
  `ActionOutcome`, not a structured `not-implemented` stub:
  - `keystroke` (E2-B): both the default respawn backend and the opt-in
    daemon backend deliver a real keyboard chord (e.g. `Meta+n`, `Tab`,
    `Escape`) and validate the result against an AX state diff.
  - `app` (E2-C, lifecycle: `launch`/`switch`/`quit`): OS-level process
    control (`open -a`/`osascript`), validated against an absolute end-state
    (running+frontmost for launch/switch, exited for quit) rather than a
    before/after diff. **Known limitation:** `quit` can return
    `success: false` with an `osascript -128` evidence trail when the target
    machine has `NSCloseAlwaysConfirmsChanges=1` and the app has an unsaved
    document — there is intentionally no force-quit fallback, so this
    capability will not discard a user's unsaved work.
  - `menuPath` (E2-D): AXMenu traversal (menu-bar or an already-open context
    menu) by an ordered list of item titles, AXPress on the final item,
    validated against a before/after AX-state diff.
- **`IBR_NATIVE_BACKEND=daemon`** (opt-in, default remains respawn) — a
  persistent Swift AX daemon that holds one long-lived process instead of
  spawning a fresh extractor per call, plus a resolved-path cache invalidated
  on tree-signature change. Falls back to the respawn backend automatically
  on any daemon fault (crash, timeout). `IBR_NATIVE_BACKEND=respawn` (or
  unset) keeps today's behavior unchanged — this is the documented rollback.

### Changed — MCP backward compatibility

- Existing `native_session_start`, `native_session_read`, and
  `native_session_close` calls are **unaffected**.
- `native_session_action`'s wire `required` array changed from
  `['sessionId', 'action', 'target']` to `['sessionId', 'action']`. This is
  **additive-permissive**: a client that always sends `target` keeps working
  unchanged, and every element verb still rejects a missing `target` at the
  handler level with the same error as before.
- The native-wire response for the new capability kinds
  (`keystroke`/`app`/`menuPath`) carries the frozen `ActionOutcome` shape
  (`validator`, `provenance`, and `evidence` on failure) — this is new wire
  content for kinds that did not exist on the wire before this increment, not
  a change to any existing response shape. Element-verb (`click`/`fill`/…)
  native responses are unchanged.

### Changed — web success-semantics fix (breaking behavior, MCP + CLI)

**`interact` (MCP), `session_action` (MCP), and `ibr interact` (CLI) — `success`
now reflects the real outcome instead of always being `true`.**

- Before: a click/fill/etc. that resolved a target but produced no visible
  change still reported `success: true` (MCP: unconditional response at the
  old `tools.ts` handler; CLI: unconditional `✓ ... succeeded` after a fixed
  500ms sleep, `src/bin/ibr.ts` around the old `interact` handler).
- After: `success` is `true` only when an expected-outcome validator passes.
  Responses gain `validator: { expected, observed, passed }` and
  `provenance` (resolution tier, confidence, wait behavior) on every action,
  plus structured `evidence` (before/after signature, diff, ranked
  alternatives, optional screenshot) when the action fails or the validator
  does not pass.
- **Action required for existing MCP/CLI clients:** any integration that
  branched only on "the call didn't throw" or always treated the response as
  successful should now check `validator.passed` / the `success` field
  directly — a `success: false` response is expected behavior for a no-op
  action, not a regression. `provenance`/`evidence` are additive fields; no
  existing field is removed or renamed.
- Tracked by the driving-foundation plan's E3-E chunk
  (`.build-loop/plans/increment-1-driving-foundation.md`, acceptance
  criterion 9). At the time of writing this change is landing as part of the
  same increment as the rest of this entry; if you observe `success: true`
  on a no-op action against a build that predates this entry, you have the
  pre-fix behavior described above.

### Fixed

- **`pressKey('Meta+k')` (and other modifier chords) now synthesize a real
  keyboard chord** instead of typing the literal characters `M`, `e`, `t`,
  `a`, `+`, `k`. This makes `flow_search`'s ⌘K command-palette fallback
  live. Mutation-first fix: a failing test proving the literal-character
  bug was written before the fix (`src/engine/cdp/input.ts`).
- **`flow_form` / `flow_login` now honor an existing `sessionId`** instead of
  always launching a fresh browser and closing it on exit, even when a valid
  session was passed. The handlers now reuse the session's driver and skip
  `launch()`/`close()` for a borrowed session. Mutation-first fix: a failing
  test proving the always-relaunch bug was written before the fix
  (`src/mcp/tools.ts`). Function signatures and the `FlowResult` shape are
  unchanged.

---

### Release gate — do not cut a version or GitHub Release yet

`keystroke`, `app` (lifecycle: launch/switch/quit), and `menuPath` (AXMenu
traversal) are all now **live** — every backend implements them and returns a
real, validated `ActionOutcome`, not a structured `not-implemented` stub. That
no longer blocks a release on its own; the gate below still applies because
`.github/workflows/publish-npm.yml` fires on GitHub Release and this
increment hasn't completed its V1 verification pass yet:

**No GitHub Release for this content until the
driving-foundation plan's V1 verification chunk passes** (live-drive demo
transcript + timing table + full green `npm test` / `npm run typecheck` /
`npm run build` / `git diff --check`). See
`.build-loop/plans/increment-1-driving-foundation.md` (`Per-chunk acceptance
criteria` → `V1` row) for the exact falsifier.
