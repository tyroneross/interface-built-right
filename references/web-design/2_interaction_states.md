# Interaction States

## Functional Integrity

Every interactive element must have a working action, real destination, or clearly marked demo/disabled state. Hide permanently unavailable actions. Disable contextually unavailable actions. Mark upgrade or coming-soon actions only when the user can understand why.

## Button Sizing

| Intent | Shape |
|---|---|
| core conversion or submit | full width on mobile, prominent on desktop |
| equal decision pair | equal side-by-side buttons |
| quick local action | compact inline button |
| icon-only action | 44px square mobile, tooltip or label |

Labels use Verb + Object with 3 words or fewer.

## Loading

| Expected wait | State |
|---|---|
| under 100ms | no indicator |
| 100ms-1s | spinner or subtle pulse |
| 1s-3s | skeleton matching final structure |
| over 3s | progress or step status with copy |

Loading copy says what is happening, not just "Loading".

## Errors

Use what -> why -> fix:

- What happened: one sentence
- Why: brief cause if known
- Fix: action the user can take

Route user errors inline near the input. Route system errors to retry with clear fault language. Route permission errors to login/upgrade/access request.

## Empty States

| Context | Pattern |
|---|---|
| first time | value promise + setup CTA |
| search | no matches + broaden/check spelling |
| filter | no results + reset filters + total count if known |
| all done | completion message + next useful action |
