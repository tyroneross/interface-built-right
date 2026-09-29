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

- **The macOS Accessibility prompt no longer reappears on every native call.**
  `ibr-ax-extract` called `AXIsProcessTrustedWithOptions` with `prompt: true`
  on every one-shot run, and an untrusted daemon falls back to that one-shot
  binary per request, so the "Open System Settings" dialog kept reappearing
  for the host terminal. Every trust check now uses `prompt: false`; an
  untrusted run exits `77` with a stderr line naming System Settings >
  Privacy & Security > Accessibility. The dialog is shown only by the explicit
  `ibr native:request-permission` (extractor flag `--request-permission`),
  and only if `~/.ibr/permissions.json` has no `accessibility.askedAt` record;
  the record is written when prompting, so it is shown at most once per user.
  To re-request: delete that file and run the command again.

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

## [1.6.0](https://github.com/tyroneross/interface-built-right/compare/v1.5.0...v1.6.0) (2026-09-29)


### Features

* **cli:** distinct exit codes (0 pass, 1 issues, 2 tool error) and a recipes epilog in --help ([8ffd0a7](https://github.com/tyroneross/interface-built-right/commit/8ffd0a7df0c9f3ff9b3cf08880f070b379f297cc))
* **cli:** machine-clean --json, a zoom-track command, and an agent quickstart ([427c4a0](https://github.com/tyroneross/interface-built-right/commit/427c4a02a77a5367c96085e5ae13d84253169cbf))
* **dashboard:** grade the standalone-document and agent-readable contract ([f19c265](https://github.com/tyroneross/interface-built-right/commit/f19c2655837dc4faa6a730710810eb63fe683e05))
* **design:** add measurable UI design specifications ([232a14f](https://github.com/tyroneross/interface-built-right/commit/232a14fe6d8d1f228ecaf1a5e699a0362a688dca))
* **design:** author and capture precise UI specs without Figma ([a2d989c](https://github.com/tyroneross/interface-built-right/commit/a2d989c1dc92f240d4ee052c52241e18de62aa5a))
* **engine:** implement IBRSession.mock() via the CDP Fetch domain ([4193eee](https://github.com/tyroneross/interface-built-right/commit/4193eeee1bd3ca1c06d2e36242a60ac1b9074f0c))
* **evidence:** record external computer-use receipts ([3a95a07](https://github.com/tyroneross/interface-built-right/commit/3a95a073f9b1ce173a805c5d435f2a112751f6e4))
* **extract:** opt-in content elements and &lt;head&gt; metadata ([1588960](https://github.com/tyroneross/interface-built-right/commit/158896040245c8f30bef697e41e71d0886bb12a0))
* **mcp:** add a session idle sweep, implemented always and disabled by default ([69a5028](https://github.com/tyroneross/interface-built-right/commit/69a502808cd4071eb9bb052d661dd96b18ec035b))
* **native:** compact numbered refs, file-out payloads and AX-diff after ref actions ([e791697](https://github.com/tyroneross/interface-built-right/commit/e7916970e59baf7192dafdee4c81508841cdd524))
* **native:** model-agnostic computer-use verb for simulators (native:cu) ([8d5dd45](https://github.com/tyroneross/interface-built-right/commit/8d5dd45b5fd8c4c6d4f08fb19ecb276d8d9dd804))
* **native:** record-and-replay with self-healing steps (native:replay) ([e8b38ab](https://github.com/tyroneross/interface-built-right/commit/e8b38abed107b4c69032b28db6610201f7bbf3ea))
* **release:** detect a release that was cut but never reached npm ([4390303](https://github.com/tyroneross/interface-built-right/commit/4390303240f6edd73abe0c6684a0151f8952b9c7))
* **scan:** report clipped and spilled text in web scan ([be7715b](https://github.com/tyroneross/interface-built-right/commit/be7715b3af6e526a1340f35bf59976e573b1f93b))
* **session:** add session:select for native &lt;select&gt; elements ([9dedd92](https://github.com/tyroneross/interface-built-right/commit/9dedd924313b30cfe592a25f4a37351b671cec6c))
* **zoom-track:** carry text and resolved colours, and rank targets by importance ([c71cdd4](https://github.com/tyroneross/interface-built-right/commit/c71cdd4af9f8195ecffa9cecc954c2d2aa7cde77))
* **zoom-track:** headings as targets, ranked by level; scan --content on the CLI ([97cb2ea](https://github.com/tyroneross/interface-built-right/commit/97cb2ea8a529ac2255af323da8758388a613d9fd))
* **zoom-track:** reach the whole page via scrollY, and accept real event times ([0e24a32](https://github.com/tyroneross/interface-built-right/commit/0e24a328bf6e6c5852df5617124a93350c952a0f))


### Bug Fixes

* address independent-audit findings on the trust fixes ([b7fbf60](https://github.com/tyroneross/interface-built-right/commit/b7fbf60dfa9836e616ee47d9fca0e158bd40bf4d))
* **browser:** reap abandoned IBR Chrome sessions ([2672ec4](https://github.com/tyroneross/interface-built-right/commit/2672ec47374bc81171a56b626762bb2c727a06d1))
* **calm-precision:** stop false positives on compliant pages in grouping, status, cognitive-load, chrome and collision checks ([e843a1f](https://github.com/tyroneross/interface-built-right/commit/e843a1f63172db2ba8731384bd235775a56b4590))
* **ci:** run the publish gate unit-only, matching ci.yml's ubuntu contract ([b15964f](https://github.com/tyroneross/interface-built-right/commit/b15964f2e23cf329a733c10bbb7c12dbd06186a6))
* **ci:** same unit-only gate on the GitHub Packages publish, plus a guard ([5311d7c](https://github.com/tyroneross/interface-built-right/commit/5311d7cfcca1e4449b6d523d0a36a357444e2813))
* **cli:** make the documented first run actually run ([ac6263a](https://github.com/tyroneross/interface-built-right/commit/ac6263a4e5ac1a422ef2871f6638711a999b6460))
* **codex:** use CLI and ignore hidden choices ([3a95330](https://github.com/tyroneross/interface-built-right/commit/3a95330115e0f896da076a5ea31e030f108c49df))
* **dist:** make the shipped CLI and MCP server runnable without node_modules ([ea7d148](https://github.com/tyroneross/interface-built-right/commit/ea7d14819845eecb938cc4f9969edec3d7033021))
* **engine:** atomic shared-profile lock for concurrent launches; correct node-id kind for element geometry ([c05d0c8](https://github.com/tyroneross/interface-built-right/commit/c05d0c8015e1e720e4caa9dba8347ca7463799ff))
* **engine:** bound every connect and spawn path, and say what it waited on ([1eba66e](https://github.com/tyroneross/interface-built-right/commit/1eba66e26b8e21ef2fb50468482818d756e6efe2))
* **engine:** keep find() from dropping an element that re-rendered between AX reads ([f8edd39](https://github.com/tyroneross/interface-built-right/commit/f8edd39c4e3c3ed086bc6a19e4c2a7eb555c9853))
* **evidence:** bound external evidence ingestion ([1a55da3](https://github.com/tyroneross/interface-built-right/commit/1a55da3dcb613c89d1ec8481af2c61c1079aa463))
* **evidence:** enforce receipt provenance ([97c572a](https://github.com/tyroneross/interface-built-right/commit/97c572a0b6b26c489a777ce6251b3cca94fa0ccf))
* **evidence:** harden receipt privacy invariants ([f5f74bd](https://github.com/tyroneross/interface-built-right/commit/f5f74bd6956ccf52b7c6fa06c06c219ef5c07f6c))
* **evidence:** preserve local receipt validity ([0423315](https://github.com/tyroneross/interface-built-right/commit/042331599e4f0641430ce8425fc7eb85107d0b33))
* **extract:** credit document/body click delegation only when the handler source names the control ([f0ccd64](https://github.com/tyroneross/interface-built-right/commit/f0ccd64936a24fcd1f059997826af609861f5411))
* **extract:** credit natively-activated buttons in NO_HANDLER and fake-interactive ([250700e](https://github.com/tyroneross/interface-built-right/commit/250700e7e20da836199578c94d384fa76ca6da97))
* **extract:** detect addEventListener handlers before flagging controls ([e4104b0](https://github.com/tyroneross/interface-built-right/commit/e4104b0f5930f4c6492ecca60a85ddd5c5a4839e))
* **extract:** judge delegation selectivity per selector-list part; trust jQuery registrations ([7930d3d](https://github.com/tyroneross/interface-built-right/commit/7930d3d24413c645d6327e6d89940a77a50c3779))
* **interactivity:** detect handlers set as properties, not just attributes ([b404e14](https://github.com/tyroneross/interface-built-right/commit/b404e149f24a13409087aea0016b5f4d651177c4))
* **mcp:** close sessions at shutdown, and reuse the warm pool for screenshots ([de842d3](https://github.com/tyroneross/interface-built-right/commit/de842d392e7c89001b2609248112c0b0418064ad))
* **native:** detect same-count AX reorders in action validators ([030d394](https://github.com/tyroneross/interface-built-right/commit/030d394f638803ba2565ae8341a8202017453ebd))
* **native:** emit each AX element once and only walk from a real AXWindow ([1f3b278](https://github.com/tyroneross/interface-built-right/commit/1f3b278771be04800cd9092a1fca027fbdadfbf9))
* **native:** exclude AppKit-owned chrome from macOS scan findings ([0afcdb5](https://github.com/tyroneross/interface-built-right/commit/0afcdb534b7eb8472de8e6133b32499f62f10764))
* **native:** open the Accessibility prompt whenever it is explicitly requested ([50fbf96](https://github.com/tyroneross/interface-built-right/commit/50fbf9654e86d74a3c7952a0314f769f22381bf6))
* **native:** reach sheet/dialog content and placeholder-only fields when driving macOS apps ([9f660a1](https://github.com/tyroneross/interface-built-right/commit/9f660a1b1ea435b83c8e78f07fc37336b957521d))
* **native:** rebuild the cached extractor when any Swift source changes ([96318f6](https://github.com/tyroneross/interface-built-right/commit/96318f6c64b4f03892ab644a1b62a4a50e44d14a))
* **native:** refuse foreground keystrokes unless the target app has focus ([fba2470](https://github.com/tyroneross/interface-built-right/commit/fba24704841c508c0049bdb59e4e232a2383eff0))
* **native:** report simulator AX as unavailable when only host chrome comes back ([d088626](https://github.com/tyroneross/interface-built-right/commit/d088626deb60d2b14de6760a81cdb0f22406eeec))
* **native:** restrict modal-window preference to focused/main dialogs ([23cc4ac](https://github.com/tyroneross/interface-built-right/commit/23cc4ac3ad65b4019a26a826e383ca4c04500d50))
* **native:** route native-hid simulator preference to headless idb instead of a not-implemented stub ([dfcd0df](https://github.com/tyroneross/interface-built-right/commit/dfcd0dfa95cad77e34be0b0e64a9f8d6f07c5db8))
* **native:** show the macOS Accessibility prompt at most once per user ([770057d](https://github.com/tyroneross/interface-built-right/commit/770057d7ec048d19e3f302c8f5768be9ff134108))
* **native:** stable refs, refuse ambiguous targets, unique-match healing ([bbc8d1c](https://github.com/tyroneross/interface-built-right/commit/bbc8d1c8c446a2f66c732e44e2e1abcf39358001))
* **obsidian:** stop reporting clipped descendants as layout collisions ([814a046](https://github.com/tyroneross/interface-built-right/commit/814a0461b41b99c57e8ae9870bf1a6f3ff408a21))
* **obsidian:** stop the test suite grading itself on what is installed ([d06d1c7](https://github.com/tyroneross/interface-built-right/commit/d06d1c7db894df2d0df4f794af47bedd7557354b))
* **release:** unblock validate:release, and test the dormancy we actually ship ([f457f64](https://github.com/tyroneross/interface-built-right/commit/f457f645dcc356134d15fe0bc7a135858c1a74b7))
* **router:** point /ibr router and preserved commands at surviving surfaces ([d4f1c84](https://github.com/tyroneross/interface-built-right/commit/d4f1c84a88f4232e0cbaa6f68280dbf5dad6f9cb))
* **rules:** stop fake-interactive from flagging natively interactive elements ([5d3580a](https://github.com/tyroneross/interface-built-right/commit/5d3580a0409d8faa3aad5bb80cb034b4ab1f0208))
* **rules:** stop grading disabled controls, which WCAG exempts ([6c482a8](https://github.com/tyroneross/interface-built-right/commit/6c482a845ce11bba7774f01c5fb9c52b72108d91))
* **scan:** an unreachable URL is a tool error, not a PASS on Chrome's error page ([7983d36](https://github.com/tyroneross/interface-built-right/commit/7983d3633c6523eac3261b89b096d84fd39f93e0))
* **semantic:** read rendered text, not innerText, when detecting error state ([cce62e5](https://github.com/tyroneross/interface-built-right/commit/cce62e57bb112a682b35bddf27ff4c6f32d2cd66))
* **sensors:** match focus rules against real elements ([d888526](https://github.com/tyroneross/interface-built-right/commit/d88852614cfb19b0ce5155f013860fc14a2831ab))
* **session:** stop leaving stale manifests, and say plainly when the CLI blocks ([a4306a4](https://github.com/tyroneross/interface-built-right/commit/a4306a461d7c7fb3f1c66d7a561fe82e453513e6))
* **summary:** stop counting unparseable-colour contrast rows as passes ([847d78f](https://github.com/tyroneross/interface-built-right/commit/847d78fab6ad582d39b3ae56d03a1ec39b40d46a))
* **types:** read sibling sources via __dirname, not import.meta (TS1470) ([9cb21de](https://github.com/tyroneross/interface-built-right/commit/9cb21de425839b656c99d3f9e4d712a6b140100d))
* **web-ui:** derive the muted text colour instead of picking one ([ce77e27](https://github.com/tyroneross/interface-built-right/commit/ce77e27ec9a9b3c285f8d6d95f0cf2aec00870e3))
* **zoom-track:** drop off-screen targets instead of aiming outside the frame ([e85d540](https://github.com/tyroneross/interface-built-right/commit/e85d54025d62a89f03c0fc502759306b5f07576c))


### Performance Improvements

* **session:** batch the per-start hard-wall scan; document the blocking start ([04b86a4](https://github.com/tyroneross/interface-built-right/commit/04b86a4ea4cfd2a2db715ed45caef2177d51c952))


### Continuous Integration

* **release:** small patch releases by default; test the real tag baseline ([8c7ed17](https://github.com/tyroneross/interface-built-right/commit/8c7ed175b126bb12d7398361123a72144864486d))

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
