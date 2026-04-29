# Information Architecture

## Page Cascade

Every page has four attention levels:

| Level | Role | Rule |
|---|---|---|
| L1 Anchor | page purpose or main insight | exactly one; largest/highest contrast |
| L2 Orient | navigation and controls | subordinate to L1; consistent position |
| L3 Primary Content | reason user came | at least 60% of mobile viewport |
| L4 Supporting | context and secondary details | hide/collapse on mobile without breaking the page |

## Navigation

- Use top navigation for small, stable destination sets.
- Use side navigation for tools with many persistent sections.
- Use tabs for sibling views of the same object or dataset.
- Use breadcrumbs only when hierarchy matters to task recovery.
- Do not make nav visually compete with the L1 anchor.

## Content-Chrome Ratio

Aim for at least 70% content to 30% chrome. Chrome includes persistent nav, toolbars, sidebars, empty decorative space, and repeated wrappers. If chrome exceeds 30%, remove decoration, collapse secondary controls, or move supporting content behind disclosure.

## Mobile

- Primary content appears before sidebars.
- L4 content moves below L3 or into a bottom sheet.
- Tables become card lists, pinned-key tables, or horizontal scroll with an overflow hint.
- Primary actions are reachable without covering primary content.
