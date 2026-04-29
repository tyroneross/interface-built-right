# IBR Primary Design Agent Upgrade

## Goal

Make IBR stronger as a primary design agent by encoding a deterministic planning layer before implementation. The upgrade should let IBR initiate design direction, choose the right UI guidance, use Mockup Gallery targets safely, apply Calm Precision 6.4.1, route web apps by archetype, and validate the resulting build contract.

## Scoring Criteria

| # | Criterion | Method | Pass Condition | Evidence |
|---|---|---|---|---|
| 1 | Design-agent completeness | Static docs/skill review | `/ibr:build` includes preamble, Design Director, specialist planning, implementation, and validation phases | `commands/build.md`, `skills/design-director/SKILL.md` |
| 2 | Guidance selection determinism | Static review | Guidance order is explicit and includes user requirements, design system, target roles, platform routers, Calm Precision, patterns, and data viz | `skills/design-director/SKILL.md`, `skills/design-guidance/SKILL.md` |
| 3 | Mockup Gallery target safety | Static review | Unrated/rejected mockups are not binding; wireframe and visual target roles are distinct | `skills/mockup-gallery-bridge/SKILL.md`, `commands/build.md` |
| 4 | Skill quality | Frontmatter/structure check | New skills have valid frontmatter, kebab-case names, and concise trigger descriptions | validation script output |
| 5 | Validation evidence | Tooling | Typecheck and/or tests complete, or failures are documented with cause | terminal output |
