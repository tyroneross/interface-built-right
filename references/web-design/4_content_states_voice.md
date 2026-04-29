# Content States And Voice

## Voice Rules

| Element | Rule | Example |
|---|---|---|
| button | Verb + Object, 3 words or fewer | Add Source |
| placeholder | instruction, not description | Search sources... |
| tooltip | what it does, 8 words or fewer | Filter by document type |
| loading | action + object/count when known | Analyzing 3 sources... |
| confirmation | what happened + what changed | Source added to research |
| destructive | action + consequence | Delete 3 files |

## Status

Use status text that includes meaning. Do not rely on color alone.

| State | Copy style |
|---|---|
| success | what completed |
| warning | what needs attention |
| error | what failed and how to recover |
| info | neutral context |

## Numeric Content

Numbers need semantic labels unless the label is already obvious from a table header or nearby title. KPI cards and corner metrics always need a label.

## Resilience

Components should tolerate string, object, markdown, null, and missing fields where the product data model allows it. Prefer flexible field names for generic content cards: title/headline/name, description/summary/body, date/timestamp/published, value/count/total.
