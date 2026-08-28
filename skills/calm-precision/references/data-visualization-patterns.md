# Data Visualization Design Guide

Patterns for displaying data across charts, graphs, tables, KPIs, timelines, and inline indicators. Works with any of the four design modes (Atmospheric Immersion, Glass Workspace, Warm Craft, Data Narrative) — apply the mode's color palette and typography, but follow these visualization-specific rules.

*Separated from cross-platform-design-patterns.md to keep each doc focused. Read that doc first for foundational rules and mode selection.*

---

## Core Principles

**Decision-first titling.** Every chart title is a concise, complete sentence stating the takeaway. "OpenAI leads AI funding at $6.6B, 65% ahead." — not "AI Funding Comparison." The reader gets the insight before looking at the data.

Two titling approaches (see Title Patterns section below for code):
- **Decision-first** (recommended): Title IS the conclusion. Subtitle adds context.
- **Descriptive + decision subtitle** (alternative): Categorical title stays, but the takeaway appears as a visually distinct subtitle below. Use when headings must stay categorical (dashboards, reports with fixed layouts).

Never use descriptive-only titles. If you use a categorical heading, the decision must appear somewhere above the chart — either as a subtitle or in the preceding paragraph.

**Figure-ground contrast.** The key finding is highlighted (blue or mode accent). Everything else is gray context. One color draws the eye; the rest provides structure.

**Ruthless decluttering.** No gridlines. No Y-axis labels on line charts (unless the scale is non-obvious). No legends unless the chart has 3+ series. No decorative borders around individual bars. The data IS the decoration.

**Direct labeling.** Values appear inline — next to bars, above peaks, inside cells. Never force the reader to cross-reference a separate legend or axis. If you need a legend, the chart might be too complex.

**Progressive disclosure.** Show the summary first. Details expand on demand. A chart title + one insight line should be enough for 80% of readers.

**Text-color-only status.** Green for positive, red for negative, gray for neutral. Never colored background badges. Status is communicated through typography, not containers.

**Tabular numbers everywhere.** `font-variant-numeric: tabular-nums` on all numeric displays. Numbers must align vertically in columns and horizontally in rows.

---

## Title Patterns

### Decision-First (Recommended)

Title states the takeaway. Keep it concise — one sentence, under ~60 characters when possible. The subtitle adds explanatory detail.

```html
<div class="chart-title">OpenAI leads AI funding at $6.6B, 65% ahead.</div>
<div class="chart-subtitle">Gap to Anthropic ($4B) widened 40% since Q3.</div>
```

```css
.chart-title {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255,255,255,0.9); /* dark mode */
  margin-bottom: 4px;
}
.chart-subtitle {
  font-size: 12px;
  color: rgba(255,255,255,0.4);
  margin-bottom: 20px;
}
```

### Descriptive + Decision Subtitle (Alternative)

When the heading must stay categorical (fixed dashboard layouts, report templates), place the decision in the subtitle with accent styling so it reads as the real headline.

```html
<div class="chart-title">AI Company Funding</div>
<div class="chart-subtitle decision">OpenAI leads at $6.6B, 65% ahead of nearest rival.</div>
```

```css
.chart-subtitle.decision {
  color: #818cf8;        /* accent color — draws the eye */
  font-weight: 500;
  font-size: 12px;
  margin-bottom: 20px;
}
/* Light mode */
.light .chart-subtitle.decision { color: #2563eb; }
/* Warm mode */
.warm .chart-subtitle.decision { color: #e8a23d; }
```

The accent color on the subtitle compensates for the weaker categorical title — it signals "this is the real point."

---

## Framework Tensions and Tradeoffs

The SWD, Duarte, and Dykes approaches broadly agree but diverge on several practical questions. Understanding the conflicts helps you make intentional choices rather than blindly applying rules.

**Annotation density: SWD declutter vs. Duarte annotate.** Knaflic emphasizes removing everything non-essential — gridlines, labels, legends. Duarte's annotation taxonomy (highlight, label, bracket, delineate, explode) encourages adding marks to guide the reader. These pull in opposite directions. Resolution: annotate the ONE key finding (peak marker, callout), then declutter everything else. A single annotation on a clean chart is more powerful than five annotations on a cluttered one.

**Title purpose: Dykes conclusion vs. Duarte narrative arc.** Dykes says the title should state the main point immediately — no buildup. Duarte's three-act structure (setup → conflict → resolution) implies the reader should experience a sequence. Resolution: use the title for the conclusion (Dykes wins here), then let the chart body create the narrative arc. The subtitle can add the "conflict" layer. Don't bury the punchline.

**Chart choice: SWD "default to bars" vs. Dykes "match the message."** Knaflic's guidance starts with horizontal bars as the default chart type. Dykes argues you should choose the chart that matches the message — a slope chart for change, a line for trajectory, a table for precision. Resolution: bars are the safe default, but if the insight is about *change between two points*, a slope chart says it better. If it's about *trajectory*, a line chart. Match the message.

**Color minimalism: SWD one-accent vs. mode palettes.** SWD says one accent color, everything else gray. But our design modes (Warm Craft amber, Glass Workspace indigo, Data Narrative blue) each have multiple accent tiers. Resolution: within any single chart, still use one accent for the key finding. The mode palette applies across the page (KPI cluster, table, annotation callouts can use different accents), but each individual chart follows the one-accent rule.

**Narrative framing: Duarte story vs. dashboard context.** Duarte's three-act structure works for presentations and reports where you control the reading order. Dashboards are non-linear — users scan, skip, zoom. Resolution: for dashboards, the decision-first title IS the story. The chart confirms it. Don't assume the user will read top-to-bottom. For article/report layouts (Data Narrative mode), the three-act structure works naturally in the prose around the chart.

**Declutter extremes: SWD no-axis vs. accessibility needs.** Knaflic says remove Y-axis labels if the title communicates the value. But screen readers and color-blind users need axes and direct labels for data access. Resolution: keep direct value labels on key data points (which satisfies both SWD and accessibility). Remove gridlines and redundant axis ticks, but never remove the only way to read a value.

---

## Chart Types

### 1. Vertical Bar Chart

**When to use:** Comparing 2-5 entities on the same metric. Ranking.

**Structure:**
```
Title (decision-first, 14px/500)
Subtitle / insight (12px, muted)

Label │████████████████████  Value
Label │████████████          Value
Label │██████                Value

Source: attribution (11px, muted)
```

**Visual specs:**
- Bar height: 20px track, 8px gap between rows
- Label column: 80px fixed width, right-aligned
- Key bar: mode accent color (e.g., `#3B82F6` in Data Narrative, `#818cf8` in Glass Workspace)
- Context bars: gray (`#D1D5DB` light mode, `rgba(255,255,255,0.15)` dark mode)
- Value labels: positioned right of bar, outside the track
- Border radius: `0 3px 3px 0` (right edge only)
- No gridlines, no Y-axis

**Key consideration:** Sort descending (largest first) unless chronological order matters more. The highlighted bar doesn't have to be the largest — it's the one that answers the title's question.

**Example (HTML):**

```html
<div class="chart-card">
  <div class="chart-title">OpenAI leads AI funding at $6.6B, 65% ahead.</div>
  <div class="chart-subtitle">Gap to Anthropic ($4B) widened 40% since Q3.</div>
  <div class="bar-chart">
    <div class="bar-row">
      <span class="bar-label">OpenAI</span>
      <div class="bar-track">
        <div class="bar-fill accent" style="width: 88%;"></div>
        <span class="bar-value">$6.6B</span>
      </div>
    </div>
    <div class="bar-row">
      <span class="bar-label">Anthropic</span>
      <div class="bar-track">
        <div class="bar-fill context" style="width: 53%;"></div>
        <span class="bar-value">$4.0B</span>
      </div>
    </div>
  </div>
  <div class="chart-source">Source: Crunchbase, Jan 2026</div>
</div>
```

```css
.bar-chart { display: flex; flex-direction: column; gap: 7px; }
.bar-row { display: flex; align-items: center; gap: 10px; }
.bar-label {
  font-size: 11px; width: 90px; text-align: right;
  color: rgba(255,255,255,0.55);
  font-variant-numeric: tabular-nums;
}
.bar-track { flex: 1; height: 22px; position: relative; border-radius: 3px; }
.bar-fill { height: 100%; border-radius: 0 3px 3px 0; }
.bar-fill.accent { background: #818cf8; }           /* key finding */
.bar-fill.context { background: rgba(255,255,255,0.08); } /* everything else */
.bar-value {
  font-size: 10px; position: absolute; right: -36px;
  top: 50%; transform: translateY(-50%);
  font-variant-numeric: tabular-nums;
}
```

### 2. Line Chart (Temporal Trends)

**When to use:** Change over time. 7+ data points. Showing trajectory, peaks, or inflection points.

**Structure:**
```
Title (decision-first)
Subtitle

     ╱╲
   ╱    ╲    ╱──
 ╱        ╲╱
─────────────────
Jan    Feb    Mar

Source: attribution
```

**Visual specs:**
- Stroke: 2px, mode accent color
- Area fill: gradient from accent at 20% opacity (top) to 0% (bottom)
- Peak marker: 4px circle at the key data point
- X-axis labels: sparse — 5 maximum, even if the chart has 30 data points
- No Y-axis labels (the peak marker + title communicate the key value)
- No gridlines
- SVG with `preserveAspectRatio="none"` for responsive sizing
- Height: ~100px (don't make line charts tall — they're about direction, not precision)

**Key consideration:** The gradient fill creates visual weight. Without it, a 2px line is too thin to scan quickly. The peak marker is the most important annotation — it's where the reader's eye should land.

**Example (SVG + HTML):**

```html
<div class="chart-card">
  <div class="chart-title">Mentions peaked at 12.4K after GPT-5 launch.</div>
  <div class="chart-subtitle">Volume declined 30%, returning to baseline.</div>
  <div class="line-chart" style="height: 130px; position: relative;">
    <svg viewBox="0 0 400 100" preserveAspectRatio="none" style="width:100%;height:100px;">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#818cf8" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="#818cf8" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <!-- Context line (muted) -->
      <path d="M0,80 L100,65 L200,45 L300,22 L400,35"
            fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
      <!-- Key segment (accent) -->
      <path d="M200,45 L300,22" fill="none" stroke="#818cf8" stroke-width="2.5"/>
      <!-- Area fill -->
      <path d="M0,80 L100,65 L200,45 L300,22 L400,35 L400,100 L0,100 Z"
            fill="url(#areaFill)"/>
      <!-- Peak dot -->
      <circle cx="300" cy="22" r="4" fill="#818cf8"/>
    </svg>
    <!-- Peak annotation (Duarte: highlight + label) -->
    <div class="peak-callout" style="top: -2px; left: 68%;">
      12.4K peak — GPT-5 launch
    </div>
    <div class="line-labels">
      <span>Jan</span><span>Feb</span><span>Mar</span>
    </div>
  </div>
</div>
```

```css
.line-chart svg { width: 100%; display: block; }
.peak-callout {
  position: absolute; padding: 3px 8px; border-radius: 4px;
  font-size: 10px; font-weight: 600;
  background: rgba(129,140,248,0.15); color: #818cf8;
  border: 0.5px solid rgba(129,140,248,0.3);
  transform: translateX(-50%);
}
.line-labels {
  display: flex; justify-content: space-between;
  margin-top: 8px; font-size: 10px;
  color: rgba(255,255,255,0.25);
}
```

### 3. Horizontal Progress Bars (Distribution)

**When to use:** Comparing 3-5 categories as proportions or raw values. Time-of-day distribution, source breakdown.

**Structure:**
```
Morning    ████████████████░░░░░░░░░░░  2h 10m
Afternoon  ██████████░░░░░░░░░░░░░░░░░  1h 30m
Evening    ████░░░░░░░░░░░░░░░░░░░░░░░  0h 45m
Night      ██░░░░░░░░░░░░░░░░░░░░░░░░░  0h 20m
```

**Visual specs:**
- Label column: 70-80px, right-aligned
- Bar track: transparent background (`rgba` at 4%), 28px height web / 24px iOS / 20px Mac
- Bar fill: category-specific color (amber for morning, blue for afternoon, etc.)
- Value: right-aligned outside bar, 40px min width
- Border radius: 4px on bar track, fills match
- Gap: 6-8px between rows

**Key consideration:** Each row should be self-contained — label, bar, value all on one line. The reader scans top-to-bottom, not left-to-right.

### 4. Bar + Trend Overlay

**When to use:** Daily activity with a smoothed trend line. Shows both individual data points and the overall direction.

**Structure:**
```
          ╱ 7-day avg
   █  █ ╱█
 █ █ ██╱ ██ █
 █ █ ███ ██ █
─────────────────
M  T  W  T  F  S  S
```

**Visual specs:**
- Bars: muted mode color at 60% opacity, flex columns with 6px gap
- Trend line: SVG polyline overlaid, white/accent at 40% opacity, 1px stroke
- Two-item legend: color swatch (12px × 3px, rounded) + label
- One Y-axis label at top (the peak value only)
- No gridlines
- Container padding: 20px top (room for the legend)

**Key consideration:** The bars show reality. The line shows the story. They work together — don't use this pattern if you only have the line.

### 5. Heatmap (Activity Grid)

**When to use:** Patterns across two dimensions — day × hour, week × category, month × metric.

**Structure:**
```
      6a  9a  12p  3p  6p  9p
  S   ░   ░   ▓    ▓   ░   ░
  M   ░   ▓   ▓    █   ▓   ░
  T   ░   ▓   █    █   ▓   ░
  W   ░   ░   ▓    █   ░   ░
  ...
```

**Visual specs:**
- Grid: CSS Grid with 2px gaps between cells
- Day labels: single letters, 9px, muted, in a 20px left column
- Hour labels: grouped (span 4 columns), 9px, muted
- Cells: opacity-based intensity on base white (dark mode) or base accent (light mode)
  - Inactive: 5% opacity
  - Low: 15% opacity
  - Medium: 45% opacity
  - High: 85% opacity
- No value labels on cells — intensity IS the data
- Auto-sized cells with 2px gap defining the grid

**Key consideration:** Heatmaps work for pattern recognition, not precise values. If the user needs to know "exactly how many sessions on Tuesday at 3pm," use a table instead. The heatmap answers "when am I most active?"

**Example (HTML):**

```html
<div class="heatmap">
  <div class="heatmap-row">
    <div class="heatmap-label">M</div>
    <div class="heatmap-cells">
      <div class="heatmap-cell"></div>       <!-- inactive: 5% opacity -->
      <div class="heatmap-cell l1"></div>    <!-- low: 12% -->
      <div class="heatmap-cell l3"></div>    <!-- medium: 45% -->
      <div class="heatmap-cell l5"></div>    <!-- high: 90% -->
    </div>
  </div>
</div>
```

```css
.heatmap-row { display: flex; align-items: center; gap: 2px; }
.heatmap-label { width: 20px; font-size: 9px; color: rgba(255,255,255,0.25); }
.heatmap-cells { display: flex; gap: 2px; flex: 1; }
.heatmap-cell { flex: 1; aspect-ratio: 1; border-radius: 2px; background: rgba(129,140,248,0.05); }
.heatmap-cell.l1 { background: rgba(129,140,248,0.12); }
.heatmap-cell.l2 { background: rgba(129,140,248,0.25); }
.heatmap-cell.l3 { background: rgba(129,140,248,0.45); }
.heatmap-cell.l4 { background: rgba(129,140,248,0.70); }
.heatmap-cell.l5 { background: rgba(129,140,248,0.90); }
/* Warm mode: swap base color to amber */
.warm .heatmap-cell    { background: rgba(232,162,61,0.05); }
.warm .heatmap-cell.l3 { background: rgba(232,162,61,0.45); }
```

### 6. Stacked Horizontal Bar (Part-of-Whole)

**When to use:** Composition breakdown — mode split, source distribution, time allocation. Maximum 4 segments.

**Structure:**
```
████████████████████████░░░░░░░░░░░░░
Pomodoro 60% · 2h 36m   Flow 25%   Adaptive 15%
```

**Visual specs:**
- Single bar: 32px height, border-radius 4px
- Segments: adjacent, no gap between them, each has its own mode/category color
- Widths: percentage-based (60% + 25% + 15% = 100%)
- Legend: below the bar, color swatches (12×12px) + text labels with percentage and duration
- Muted text (opacity 0.55) for legend
- No borders between segments

**Key consideration:** If you have more than 4 segments, the smallest ones become invisible. Merge small categories into "Other" or switch to a horizontal bar chart.

**Example (HTML):**

```html
<div class="chart-card">
  <div class="chart-title">Pomodoro leads at 58%; Flow grew 12% this month.</div>
  <div class="stacked-bar">
    <div class="stacked-segment" style="width:58%; background:#818cf8;"></div>
    <div class="stacked-segment" style="width:27%; background:#22d3ee;"></div>
    <div class="stacked-segment" style="width:15%; background:#a78bfa;"></div>
  </div>
  <div class="stacked-legend">
    <div class="legend-item">
      <div class="legend-dot" style="background:#818cf8;"></div>
      <span class="legend-pct">58%</span>
      <span class="legend-label">Pomodoro</span>
    </div>
    <!-- repeat for each segment -->
  </div>
</div>
```

```css
.stacked-bar { height: 28px; border-radius: 6px; overflow: hidden; display: flex; }
.stacked-segment { height: 100%; }  /* width set inline as percentage */
.stacked-legend { display: flex; gap: 16px; margin-top: 12px; }
.legend-dot { width: 8px; height: 8px; border-radius: 2px; }
.legend-pct { font-size: 11px; color: rgba(255,255,255,0.55); }
.legend-label { font-size: 11px; color: rgba(255,255,255,0.35); }
```

### 7. Data Table

**When to use:** Mixed data types, comparison across multiple attributes, spec sheets. When precision matters more than pattern recognition.

**Structure:**
```
HEADER₁        HEADER₂        HEADER₃
─────────────────────────────────────
Title           Value          Status
description     +change        ●
─────────────────────────────────────
Title           Value          Status
description     +change        ●
```

**Visual specs:**
- Headers: 11px uppercase, muted gray, `letter-spacing: 0.3px`
- Row dividers: 1px solid (gray-100 light / rgba 0.06 dark)
- Cell padding: 12px
- Hover: subtle background shift (`gray-50` light / `rgba(255,255,255,0.02)` dark)
- Status: text color only (green/red), no badges
- Numbers: `tabular-nums`, bold (14px), right-aligned
- Changes: 11px, green for positive, red for negative

**Three-line cell hierarchy** (when cells contain rich content):
1. Title: 13px bold
2. Description: 12px muted
3. Meta: 11px, most muted

**Key consideration:** Right-align all numeric columns. Left-align text. This is non-negotiable for scannability.

**Example (HTML):**

```html
<table class="data-table">
  <thead>
    <tr>
      <th>Model</th>
      <th class="right">Score</th>
      <th class="right">Δ 6mo</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="accent">Claude 4</td>       <!-- accent = key finding row -->
      <td class="right accent">93.2%</td>
      <td class="right positive">+4.1%</td>  <!-- green text, no badge -->
    </tr>
    <tr>
      <td class="primary">GPT-5</td>          <!-- primary = important but not key -->
      <td class="right">92.1%</td>
      <td class="right positive">+2.8%</td>
    </tr>
  </tbody>
</table>
```

```css
.data-table { width: 100%; border-collapse: collapse; }
.data-table th {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: rgba(255,255,255,0.3);
  padding: 0 8px 10px; text-align: left;
  border-bottom: 0.5px solid rgba(255,255,255,0.06);
}
.data-table td {
  font-size: 12px; padding: 10px 8px;
  border-bottom: 0.5px solid rgba(255,255,255,0.04);
}
.data-table td.right { text-align: right; font-variant-numeric: tabular-nums; }
.data-table td.accent { color: #818cf8; font-weight: 600; }
.data-table td.positive { color: #34d399; }
.data-table td.negative { color: #fb7185; }
```

### 8. KPI Cluster (Hero Metrics)

**When to use:** Top-of-page summary. 3-4 key metrics the user checks first.

**Two styles:**

*Compact (no container):*
```
12          4h 20m      ~25m
sessions    focus       sweet spot
+3 vs wk   +45m vs wk
```
- Value: 28px/700, primary text color
- Label: 12px, secondary opacity
- Delta: 11px, green/red, `tabular-nums`
- No borders, no backgrounds — values float on the page

*Glass card (Atmospheric Immersion):*
```
┌──────────────────────────┐
│   12    │    4:20         │
│ sessions│  hours focused  │
│   +3    │    +45m         │
├──────────────────────────┤
│ 🔥 5 days    longest: 12  │
└──────────────────────────┘
```
- Value: 36px/200 (ultralight), frosted glass card
- Dividers between metrics
- Summary/streak row at bottom
- Border-radius: 12px, blur 20px

**Key consideration:** 3 metrics is the sweet spot. 4 is the maximum. More than 4 and the reader doesn't know where to look first.

**Example (HTML — compact style):**

```html
<div class="kpi-row">
  <div class="kpi-item">
    <div class="kpi-value">15</div>
    <div class="kpi-label">sessions</div>
    <div class="kpi-delta up">+3 vs last wk</div>
  </div>
  <div class="kpi-item">
    <div class="kpi-value">5h 12m</div>
    <div class="kpi-label">focus time</div>
    <div class="kpi-delta up">+56m vs last wk</div>
  </div>
  <div class="kpi-item">
    <div class="kpi-value">~25m</div>
    <div class="kpi-label">sweet spot</div>
    <div class="kpi-delta neutral">no change</div>
  </div>
</div>
```

```css
.kpi-row { display: flex; gap: 24px; }
.kpi-item { flex: 1; }
.kpi-value {
  font-size: 32px; font-weight: 200; letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.kpi-label { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px; }
.kpi-delta { font-size: 11px; font-weight: 500; margin-top: 4px; }
.kpi-delta.up { color: #34d399; }
.kpi-delta.down { color: #fb7185; }
.kpi-delta.neutral { color: rgba(255,255,255,0.25); }
```

### 9. Quality Dots (Rating Scale)

**When to use:** Discrete 1-5 quality/satisfaction score. Inline within cards or list items.

```
●●●●○  (4/5)
```

**Visual specs:**
- Dot size: 6px diameter
- Gap: 3px between dots
- Filled: inherits current text color (or category accent)
- Empty: white at 12% opacity (dark mode) / gray-200 (light mode)
- Layout: horizontal flex, `margin-left: 8px` from preceding text
- Never use half-filled dots — this is a discrete scale

**Key consideration:** Quality dots are the most compact rating indicator. Use them in list items, timeline entries, and table cells where a number would add clutter.

### 10. Timeline (Chronological Events)

**When to use:** Session history, activity log, changelog, event feed. Chronological order.

**Structure:**
```
── WEEK OF MAR 17 ─────────────────
    10h 20m · 24 sessions

●  10:42 AM
│  ┌───────────────────────────┐
│  │▌ 25m Pomodoro    ●●●●○   │
│  │  Focus: 94% · Xcode 18m  │
│  └───────────────────────────┘
│
●  8:30 AM
│  ┌───────────────────────────┐
│  │▌ 55m Flow        ●●●○○   │
│  │  Deep work on Module X    │
│  └───────────────────────────┘
```

**Visual specs:**
- Timeline line: 1px vertical, `rgba(255,255,255,0.06)`, positioned 24px from left edge
- Dot: 8px circle at each event, colored by category/mode
- Card: frosted glass (dark mode) or white with shadow (light mode), border-left 2px colored
- Timestamp: 11px monospace, muted, positioned left of dot
- Week milestone: horizontal line + uppercase label inline, weekly stats below

**Content hierarchy within card:**
1. Title (15px/600): duration + mode name
2. Quality dots (6px, inline)
3. Detail line (12px, muted): focus %, apps used
4. Optional signal line (11px, colored): alerts or patterns

**Key consideration:** The vertical line connects events visually without requiring the reader to track time mentally. The colored dots allow scanning by category. Remove the line if events are sparse (less than 3 per day).

### 11. Sparkline (Inline Mini Chart)

**When to use:** Compact trend indicator within a table cell, KPI card, or text paragraph. Shows direction, not precision.

**Visual specs:**
- Width: 60-80px
- Height: 16-20px
- Stroke: 1-2px, accent color or gray
- No axes, no labels, no fill
- SVG inline
- Optional: terminal dot at the most recent value

**Key consideration:** Sparklines answer one question: "is this going up, down, or flat?" If the reader needs more, link to a full chart.

### 12. Slope Chart (Change Between Two Points)

**When to use:** Comparing rank or value shifts between exactly two time periods. Shows who gained, who lost, and crossover points at a glance. SWD recommends slope charts over grouped bar charts when the story is about change, not absolute values.

**Structure:**
```
Q1 2025                    Q1 2026
  45%  ─────────────────  37%   React (context)
  28%  ─────────────────  40%   Vue (accent — the story)
  20%  ─────────────────  15%   Angular (context)
```

**Visual specs:**
- Two vertical positions (left period, right period) connected by angled lines
- Key finding line: 2px stroke, mode accent, 4px endpoint circles
- Context lines: 1-1.5px stroke, `rgba(255,255,255,0.1)`, 3px endpoint circles
- Labels: value left of left dot, value + name right of right dot
- Period labels: 10px uppercase, muted, top of chart
- No gridlines, no axes — the slopes ARE the visualization
- SVG viewBox for responsive sizing

**Key consideration:** Slope charts only work with two time points. For three or more, use a line chart. The visual power comes from the angle — steep slopes draw the eye to the biggest changes.

**Example (SVG):**

```html
<div class="slope-chart">
  <div class="slope-labels">
    <span class="slope-period">Q1 2025</span>
    <span class="slope-period">Q1 2026</span>
  </div>
  <svg viewBox="0 0 400 140" style="width:100%;height:140px;">
    <!-- Vue (accent — the story) -->
    <circle cx="40" cy="95" r="4" fill="#818cf8"/>
    <text x="5" y="99" fill="rgba(129,140,248,0.8)" font-size="11">28%</text>
    <line x1="44" y1="95" x2="356" y2="42" stroke="#818cf8" stroke-width="2"/>
    <circle cx="360" cy="42" r="4" fill="#818cf8"/>
    <text x="370" y="46" fill="rgba(129,140,248,0.9)" font-size="11" font-weight="600">40%</text>
    <text x="370" y="60" fill="rgba(129,140,248,0.5)" font-size="9">Vue</text>
    <!-- React (context — muted) -->
    <circle cx="40" cy="40" r="3" fill="rgba(255,255,255,0.2)"/>
    <text x="5" y="44" fill="rgba(255,255,255,0.3)" font-size="11">45%</text>
    <line x1="43" y1="40" x2="357" y2="55" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/>
    <circle cx="360" cy="55" r="3" fill="rgba(255,255,255,0.2)"/>
    <text x="370" y="59" fill="rgba(255,255,255,0.3)" font-size="11">37%</text>
    <text x="370" y="73" fill="rgba(255,255,255,0.2)" font-size="9">React</text>
  </svg>
</div>
```

```css
.slope-chart svg { width: 100%; display: block; }
.slope-labels { display: flex; justify-content: space-between; margin-bottom: 8px; }
.slope-period {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.08em; color: rgba(255,255,255,0.3);
}
```

### 13. Skeleton Loader (Loading State)

**When to use:** While data is being fetched. In place of every chart, table, or KPI cluster.

**Visual specs:**
- Gray rectangles matching the approximate shape of the final content
- Shimmer animation: linear gradient sweep from left to right, 1.5s, infinite
- Match the layout structure (bar shapes for bar charts, row shapes for tables)
- Never use spinners

**Key consideration:** The skeleton should set expectations. If the final content is a bar chart, the skeleton should look like bar-shaped rectangles, not a generic loading block.

---

## Annotation Patterns

### Insight Callout (Inline)

Place within data flow to surface a pattern or recommendation.

```
┌──────────────────────────────────┐
│ [left-border 2px accent]         │
│ ☀️ Morning sessions are your best │
│ 3 consecutive mornings with 4+   │
│ quality scores.                  │
└──────────────────────────────────┘
```

- Background: `rgba(accent, 0.05)`
- Border: `1px solid rgba(accent, 0.1)` + `border-left: 2px solid accent`
- Title: 12px/600, body: 12px/400 muted
- On Watch: compress to single line of accent-colored text

**Example (HTML):**

```html
<div class="insight-callout">
  <div class="callout-title">Morning sessions are your best</div>
  <div class="callout-body">3 consecutive mornings with 4+ quality scores.</div>
</div>
```

```css
.insight-callout {
  padding: 10px 12px; border-radius: 8px;
  background: rgba(129,140,248,0.04);
  border: 0.5px solid rgba(129,140,248,0.1);
  border-left: 2px solid rgba(129,140,248,0.3);
}
.callout-title { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.8); }
.callout-body { font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 2px; }
```

### Source Attribution

Every visualization gets a source line.

```
Source: Crunchbase, Jan 2026 · Updated daily
```
- Size: 11px
- Color: tertiary (most muted)
- Position: bottom of chart container, left-aligned
- Include update frequency if data is live

### No-Chart State

When data doesn't suit visualization, use a narrative summary.

```
Title (decision-first)
Subtitle

Summary paragraph with bold emphasis on key numbers.
The narrative explains what the data means in context.

▼ Show key points from 12 articles

Source: attribution
```

- Container: light gray background (`#F3F4F6` light / `rgba(255,255,255,0.03)` dark)
- Summary: 14px, line-height 1.6
- Bold emphasis on key numbers/findings
- Progressive disclosure: collapsible key points list

---

## Color Application by Mode

The chart patterns above use generic colors. Apply your mode's palette:

| Element | Atmospheric Immersion | Glass Workspace | Warm Craft | Data Narrative |
|---------|----------------------|-----------------|------------|----------------|
| Key finding highlight | Mode color (indigo/teal/purple) | `#818cf8` indigo | `#e8a23d` amber | `#3B82F6` blue |
| Context bars/lines | `rgba(255,255,255,0.15)` | `rgba(255,255,255,0.1)` | `#302c26` | `#D1D5DB` |
| Positive delta | `#34d399` | `#34d399` | `#7cb587` sage | `#059669` |
| Negative delta | `#fb7185` | `#fb7185` | `#cf6b54` rust | `#DC2626` |
| Chart background | transparent (glass card) | transparent (glass card) | `#211e19` (warm surface) | `#FFFFFF` / `#F9FAFB` |
| Text on chart | `rgba(255,255,255,0.87/0.55/0.35)` | same | `#f5f0e8/#b8af8a/#7d7468` | `#111827/#4b5563/#9ca3af` |

---

## Platform Sizing

| Component | Web | iOS | Mac | Watch |
|-----------|-----|-----|-----|-------|
| Bar height | 28px | 24px | 20px | 12px |
| Bar radius | 4px | 6px | 4px | 4px |
| Chart container padding | 16-20px | 14-16px | 14-16px | 8px |
| Heatmap cell gap | 2px | 2px | 2px | N/A |
| KPI value size | 28px | 28px | 24px | 34pt |
| Quality dot size | 6px | 6px | 6px | 6px |
| Timeline dot size | 8px | 8px | 8px | N/A |
| Table cell padding | 12px | 10px | 10px | N/A |
| Sparkline width | 80px | 60px | 70px | 40px |

---

## Implementation Priority for Data-Heavy Views

1. **KPI cluster** — the first thing the user sees, sets context for everything below
2. **Primary chart** — the one visualization that answers the page's main question
3. **Decision-first title + insight line** — even before the chart renders, the reader gets the answer
4. **Data table** (if applicable) — for drill-down and precision
5. **Skeleton loaders** — so the page feels fast even when data is loading
6. **Timeline / secondary charts** — supporting detail
7. **Insight callouts** — added intelligence, not core

---

## Confidence Gate: When to Show a Chart

A chart requires all three conditions before rendering. If any fails, fall back to text.

1. **Minimum 3 comparable data points.** A bar chart with 1-2 bars looks broken, not insightful. A line chart with 2 points is just a slope — use text instead.
2. **Data confidence is medium or high.** If the underlying data is sparse, incomplete, or unreliable, a misleading chart is worse than no chart. Show a narrative summary instead.
3. **Source attribution exists.** Every chart must be traceable to its data source. No source, no chart.

A chart appears only when it communicates something text alone cannot communicate as effectively. Every chart must pass this test: "Does this visualization reveal a pattern, comparison, distribution, or trend that would take 3+ sentences to describe and still be less clear?" If no, use text.

---

## When Charts Do NOT Add Value

| Signal | Example | Why Text Wins |
|--------|---------|---------------|
| Single data point | "How many articles today?" | One number. Say it. |
| Qualitative summary | "What are people saying about X?" | Themes and opinions need narrative, not axes |
| Simple lookup | "Who wrote the most-shared article?" | A name and a number. No chart. |
| Insufficient data | Any query returning < 3 comparable points | Charts with 1-2 bars look broken |
| Low confidence data | Sparse or unreliable aggregations | A misleading chart is worse than none |
| Single comparison | "Is X bigger than Y?" | A sentence handles two values |

When in doubt, default to text. A missing chart is invisible. A bad chart actively misleads.

---

## Chart Type Quick Reference

*Types with full specs in this doc are marked ●. Types marked ○ are defined in app-specific guides (e.g., Atomize Integration Guide) and follow the same principles.*

| Chart Type | Best For | Min Points | Max Practical | Time Axis? | Series? | Spec |
|------------|----------|-----------|---------------|------------|---------|------|
| Vertical bar | Category values | 3 | 50 | Optional | No | ● |
| Horizontal bar / progress | Rankings, long labels, distribution | 3 | 30 | No | No | ● |
| Line | Trends over time | 3 | 500 | Required | Optional | ● |
| Bar + trend overlay | Daily activity with smoothed line | 7 | 60 | Required | 2 (bar+line) | ● |
| Slope | Change between two periods | 2 series | 6 series | 2 periods only | Required | ● |
| Heatmap | Two-dimension density | 9 (3×3) | 500 cells | Optional | N/A | ● |
| Stacked bar | Part-of-whole | 2 | 4 segments | No | N/A | ● |
| Data table | Mixed types, precision | 2 rows | 50 rows | Optional | Optional | ● |
| KPI cluster | Hero metrics | 2 | 4 | No | N/A | ● |
| Quality dots | Discrete rating | N/A | 5 scale | No | No | ● |
| Timeline | Chronological events | 3 | 50 | Required | Optional | ● |
| Sparkline | Inline trend | 5 | 60 | Implied | No | ● |
| Skeleton | Loading state | N/A | N/A | N/A | N/A | ● |
| Stacked area | Composition over time | 3/series | 200/series | Required | Required (3+) | ○ |
| Grouped bar | Period comparisons | 3 | 20 | Optional | Required (2) | ○ |
| Donut | Proportional breakdown | 2 | 8 | No | No | ○ |
| Radar | Multi-dimensional scoring | 3 | 10 | No | Optional | ○ |
| Treemap | Hierarchical categories | 6 | 100 leaves | No | No | ○ |
| Funnel | Sequential stage conversion | 3 | 8 | No | No | ○ |
| Scatter | Two-variable correlation | 5 | 300 | No | Optional | ○ |
| Waterfall | Change attribution | 3 | 15 | No | No | ○ |
| Bump | Rank changes over time | 2 periods | 10 × 20 | Required | Required | ○ |

If your data exceeds the max practical limit, downsample (line), paginate (table), collapse small categories into "Other" (donut), or aggregate into larger time bins (heatmap).

---

## Data Point Limits and Mitigations

| Chart Type | Max Before Degradation | Mitigation |
|------------|----------------------|------------|
| Line | 500 | Downsample: pick every Nth point |
| Vertical/horizontal bar | 50 / 30 | Paginate or horizontal scroll |
| Stacked area | 200 per series | Reduce series count or aggregate |
| Donut | 8 slices | Group remainder into "Other" |
| Sparkline | 60 | Rolling window |
| Heatmap | 500 cells | Aggregate into larger time bins |
| Stacked bar | 4 segments | Merge small categories |
| Slope | 6 series | Show only top N + "Other" |
| Data table | 50 rows | Paginate, show top N with expand |
| KPI cluster | 4 metrics | Pick the 3 that matter most |
| Timeline | 50 entries | Paginate by week, collapse older |
| Treemap | 100 leaves | Collapse small categories |
| Funnel | 8 stages | Collapse intermediate stages |
| Scatter | 300 points | Sample or cluster |
| Waterfall | 15 segments | Group minor contributors |
| Bump | 10 entities × 20 periods | Limit to top N entities |
| Radar | 10 dimensions | Combine related dimensions |

---

## Animation Rules

- **Entry animation:** On for initial render, 300–500ms duration
- **Easing:** `ease-out` only — no bounce, no spring, no elastic
- **Sparklines:** No animation — inline elements should appear instantly
- **Hover:** Subtle opacity or scale shifts only, < 150ms
- **Transitions between data states:** Cross-fade at 200ms, not morphing
- **Skeleton loaders:** Shimmer gradient sweep, 1.5s, infinite loop
- **Never animate:** Axis labels, legends, source attribution, chart titles

These rules apply across all modes. Atmospheric Immersion can extend entry duration to 500ms. Glass Workspace and Data Narrative should stay at 300ms for a snappier feel. Warm Craft can use 400ms.

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Chart renders at 0 height | Always set a minimum height (200px compact, 300px standard, 400px feature) |
| Colors don't match dark mode | Use CSS variables or mode-aware palette, not hardcoded hex |
| Tooltip shows raw object | Ensure data key names match what the tooltip expects |
| Legend overlaps chart | Place legend below chart, not inside it; or remove if < 3 series |
| Axis labels cut off | Add margin/padding around chart container |
| Bar labels overlap | Reduce bar count, truncate labels, or rotate to horizontal layout |
| Area series invisible | Each series needs a distinct stack ID for proper layering |
| Donut center label misaligned | Use viewBox-based positioning, not absolute CSS |
| Data refetches on every render | Memoize data transforms; cache API responses |
| Chart appears when it shouldn't | Enforce the confidence gate — min 3 data points, source attribution |
| Wrong chart type chosen | Let data shape resolve the type; intent suggests, data confirms |
| Chart without narrative context | Always pair with a decision-first title + subtitle; text above and below |
| All bars same color when one should stand out | Apply figure-ground — accent the key finding, gray the rest |
| Too many charts on one view | Cap at 3 per response/section; more than that is a dashboard problem |

---

*Reference mockups in `mockups/` folder: data-storytelling-chart-patterns.html (SWD/Duarte/Dykes patterns, title comparisons, slope chart), flodoro--04-insights-calm-precision.html (bars, heatmap, KPI), flodoro--07-insights-timeline.html (timeline, dots), atomize--chart-visualization-mockups.html (all chart types), atomize--concept-d-full-app.html (sparklines, skeletons).*
