# Scorecard: Primary Design Agent Upgrade

| Criterion | Status | Evidence |
|---|---|---|
| Design-agent completeness | Pass | `commands/build.md` now includes preamble, Design Director, specialist planning, implementation, and validation phases. `skills/design-director/SKILL.md` defines required artifacts. |
| Guidance selection determinism | Pass | `skills/design-director/SKILL.md` and `skills/design-guidance/SKILL.md` define ordered guidance selection. |
| Mockup Gallery target safety | Pass | `skills/mockup-gallery-bridge/SKILL.md` blocks unrated/rejected mockups by default and separates `wireframe-target` from `visual-target`. |
| Skill quality | Pass | Frontmatter validation passed for the new and heavily edited skills. New skill files are under 200 lines. |
| Validation evidence | Partial pass | `npm run typecheck` passed. Targeted non-browser tests passed: 7 files, 64 tests. Full `npm test -- --run` is blocked by Chrome debugger startup in sandboxed CDP integration suites. |

## Notes

This is primarily a docs/skills/workflow upgrade. It intentionally avoids new runtime dependencies. One small stale test import cleanup was made so TypeScript validation could pass.

## Commands

```text
node frontmatter validation script
npm run typecheck
npm test -- --run src/flows/types.test.ts src/mockup-gallery/reader.test.ts src/mockup-gallery/writer.test.ts src/ui-guidance/library.test.ts src/design-system/principles/principles.test.ts src/rules/rules.test.ts src/schemas.test.ts
```

## Known Validation Limitation

`npm test -- --run` fails in `src/engine/compat.test.ts` and `src/engine/engine.integration.test.ts` because Chrome debugger does not respond within 5s in this sandbox. The failure points to connect mode: `--browser-mode connect --cdp-url http://127.0.0.1:9222`.
