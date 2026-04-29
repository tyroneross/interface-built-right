---
name: data-visualization
description: Use when UI work includes charts, graphs, dashboards, KPIs, analytical search responses, metrics, tables, trend lines, rankings, distributions, or data storytelling. Provides chart-worthiness gates, chart routing, hierarchy, attribution, accessibility, and validation rules.
version: 0.1.0
user-invocable: false
---

# Data Visualization

Use this skill when an interface includes charts, metrics, KPIs, analytical cards, or dashboard summaries. The goal is not to add charts. The goal is to show data only when the visual reveals a pattern faster and more accurately than text.

## Chart-Worthiness Gate

Render a chart only when all are true:

1. The visual reveals a trend, ranking, comparison, distribution, correlation, flow, density, balance, or attribution.
2. There are at least 3 comparable data points, except part-to-whole where 2 slices can be acceptable.
3. The data source is real or clearly marked as demo/prototype.
4. The chart has source attribution or a visible provenance path.
5. The surrounding UI states the insight in natural language.

If the gate fails, use text, a table, or a KPI callout instead.

## Insight-First Structure

Every chart block needs:

- Insight title: one sentence stating the takeaway
- Context: date range, population, source, or filter
- Visual: the smallest chart that proves the insight
- Annotation or emphasis: one focal point, not decorative color
- Attribution: "Based on..." or equivalent provenance

Never let the chart be the first explanation. The chart proves the claim; it does not make the claim alone.

## Chart Routing

| Data relationship | Use | Avoid |
|---|---|---|
| Single number | KPI callout with semantic label | chart |
| Change over time | line, area, sparkline | pie/donut |
| Ranking | horizontal bar | vertical bars with long labels |
| Comparison | grouped bar or side-by-side metric | stacked when exact comparison matters |
| Part-to-whole | stacked bar, donut only for 2-6 clear slices | many-slice pie |
| Distribution | histogram, bar, treemap for hierarchy | overloaded donut |
| Correlation | scatter | dual-axis unless unavoidable |
| Change attribution | waterfall | stacked bar |
| Flow/funnel | funnel or step list with conversion rates | decorative pipeline |
| Density by two dimensions | heatmap | table of raw counts |
| Balance across dimensions | radar only for small sets; otherwise bar group | radar with many axes |

When intent and data shape disagree, data shape wins. Do not force a requested chart type if it misrepresents the data.

## Visual Rules

- Use one focal color; mute non-focal series.
- Remove chart borders and decorative backgrounds unless the container needs grouping.
- Use light gridlines only when they support reading values.
- Label numbers with units and semantic context.
- Cap donut slices at 6 visible categories plus "Other".
- Cap visible ranking bars at 10 unless the task is exploration.
- Prefer direct labels over legends when there are few series.
- Use tables when users must inspect exact values across many rows.
- On mobile, allow horizontal scroll for wide time series or switch to a ranked/card summary.

## Accessibility

- Provide a text summary of the insight near the chart.
- Ensure colors are not the only encoding; include labels, icons, patterns, or direct text.
- Tooltip content must be reachable or duplicated in accessible text where needed.
- Contrast must meet WCAG AA for labels and annotations.
- Interactive chart controls need 44px mobile touch targets.

## Validation

Add these checks to `specialists/data-viz.md` and `specialists/validation-plan.md`:

- Chart-worthiness gate passed
- Data sufficiency documented
- Source attribution present
- Chart type matches data relationship
- Focal emphasis does not obscure exact values
- Empty/loading/error states exist for chart data
- Mobile layout is readable at 320px
- No chart renders from stale, missing, or fake-real data

*ibr - data visualization*
