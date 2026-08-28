# Calm Precision 6.6.0 — Implementation Patterns

Full code examples, mobile patterns, voice calibration, and component templates.

## Page-Level Hierarchy

| Level | Role | Characteristics | Example |
|-------|------|-----------------|---------|
| L1 Anchor | One per page. First thing eye hits. | Largest text, highest contrast | Page title, hero metric |
| L2 Orient | Navigation and controls. | Smaller than L1, fixed position | Top nav, breadcrumbs |
| L3 Primary | The reason user came. ≥60% viewport. | Three-line hierarchy within | Feed cards, tables, forms |
| L4 Supporting | Context that aids L3. Hideable on mobile. | Smallest, lowest contrast | Metadata panels, help text |

```jsx
function PageLayout({ title, nav, children, sidebar }) {
  return (
    <div className="min-h-screen">
      {/* L1 Anchor */}
      <header className="px-4 pt-6 pb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{title}</h1>
      </header>
      {/* L2 Orient */}
      <nav className="px-4 py-2 border-b border-gray-200 sticky top-0 bg-white z-10">{nav}</nav>
      <div className="flex">
        {/* L3 Primary Content */}
        <main className="flex-1 min-w-0 p-4">{children}</main>
        {/* L4 Supporting */}
        {sidebar && (
          <aside className="hidden lg:block w-72 p-4 border-l border-gray-200">{sidebar}</aside>
        )}
      </div>
    </div>
  );
}
```

L1 sizing: Mobile `text-2xl` (24px), Desktop `text-3xl` (30px). Never smaller than L2 nav text.

## Three-Line Content Structure

- **Title:** 14-16px, medium weight, high contrast (7:1)
- **Description:** 12-14px, regular, medium contrast (4.5:1), 3-4 line limit
- **Metadata:** 11-12px, regular, low contrast (3:1)
- **Spacing:** 3-4px after title, 4px after description (8pt grid)
- **Mobile:** Max 2 lines for title

## Contextual Metric Display

```jsx
function MetricDisplay({ value, label, color = 'text-blue-600' }) {
  if (!value) return null;
  return (
    <div className="text-right">
      <span className={`text-sm font-bold ${color}`}>{value}</span>
      {label && <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>}
    </div>
  );
}
```

Value: 14px bold, accent. Label: 10-11px, gray-400, 2px gap.
Skip label when: explicit label nearby, column header in table, self-evident (% in progress bar).

## Flexible Content Handling

```jsx
function ContentCard({ data }) {
  if (typeof data === 'string') return renderMarkdown(data);

  const title = data.title || data.headline || data.name;
  const desc = data.description || data.summary || data.content;
  const meta = data.date || data.timestamp;
  const metricValue = data.value || data.amount || data.count;
  const metricLabel = data.label || data.unit || data.context;

  return (
    <div>
      {title && <h3 className="font-medium">{title}</h3>}
      {desc && <p className="text-gray-600">{desc}</p>}
      {meta && <span className="text-gray-500 text-xs">{meta}</span>}
      {metricValue && (
        <div className="text-right">
          <span className="text-sm font-bold text-blue-600">{metricValue}</span>
          {metricLabel && <p className="text-[10px] text-gray-400 mt-0.5">{metricLabel}</p>}
        </div>
      )}
    </div>
  );
}
```

Field alternatives: title/headline/name/subject, description/summary/content/body, date/timestamp/published/created_at, value/amount/count/total, label/unit/context.

## Navigation Implementation

### Top Nav
```jsx
<nav className="flex gap-8 border-b border-gray-200">
  {tabs.map(tab => (
    <button className={`py-4 text-sm ${
      active === tab
        ? 'text-gray-900 font-medium border-b-2 border-gray-900'
        : 'text-gray-600 hover:text-gray-900'
    }`}>{tab}</button>
  ))}
</nav>
```

### Side Nav
```jsx
<nav className="w-56 space-y-1 p-3">
  <h3 className="text-xs uppercase text-gray-500 tracking-wide px-3">Section</h3>
  {items.map(item => (
    <button className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg ${
      active === item
        ? 'bg-blue-50 text-blue-700 font-medium'
        : 'text-gray-700 hover:bg-gray-100'
    }`}>
      <Icon size={18} /><span>{item}</span>
    </button>
  ))}
</nav>
```

**Top nav:** Unselected `gray-600` | Hover `gray-900` (150ms) | Selected: a 2px bottom border, an outlined accent pill (accent border + accent text, transparent fill), or a soft accent-tint fill (≤12%) carrying no border. Prefer the tint-only fill in dark themes, where a border indicator reads as a competing edge. The anti-pattern is a saturated filled pill that outweighs the label it marks — weight, not fill.

**Side nav:** Width 224px, padding 12px h / 8px v. Selected `bg-blue-50 text-blue-700`. Icons 18px same color as text.

**Section headers:** 11px uppercase, `gray-500`, tracking-wide.

**Dropdowns:** Width 224px, padding 16px h, hover `bg-gray-50`, danger separated + `red-600`.

## Card Interaction States

### Navigating card (desktop)
```jsx
<div className="bg-white border border-gray-200 rounded-xl p-4
  transition-all duration-200 ease-out
  hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-200/50
  hover:border-gray-300 cursor-pointer">
```

### Card with inline actions
```jsx
<div className="bg-white border border-gray-200 rounded-xl p-4
  transition-all duration-200 ease-out
  hover:-translate-y-px hover:shadow-md hover:shadow-gray-200/50
  hover:border-gray-300">
```

### Non-interactive card
```jsx
<div className="bg-white border border-gray-200 rounded-xl p-4">
```

### Mobile press-in
```html
<div class="... active:scale-[0.98] transition-transform duration-100">
```

Timing: 200ms desktop, 100ms mobile. `ease-out`. Always pair lift with `cursor-pointer`.

## Staggered State Transitions

```jsx
{items.map((item, index) => (
  <span
    className={`transition-all duration-300 ${
      isActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
    }`}
    style={{ transitionDelay: `${index * 60}ms` }}
  >{item.label}</span>
))}
```

**Exit stagger (reverse or simultaneous):**
```jsx
style={{
  transitionDelay: isEntering
    ? `${index * 60}ms`
    : `${(total - index) * 30}ms`
}}
```

Forward stagger on removal feels hesitant — exit simultaneous or reverse-faster. Mobile: reduce delays 30-40%. Skip stagger for `active:` press states.

## Error & Empty State Components

### Error State
```jsx
function ErrorState({ what, why, fix, onRetry }) {
  return (
    <div className="text-center py-8 px-4">
      <div className="mx-auto mb-3 w-10 h-10 rounded-full flex items-center justify-center bg-red-100 text-red-600">
        <AlertIcon size={20} />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">{what}</h3>
      {why && <p className="text-sm text-gray-600 mb-4">{why}</p>}
      {onRetry && (
        <button onClick={onRetry} className="h-10 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium">
          {fix || 'Try Again'}
        </button>
      )}
    </div>
  );
}
```

### Empty State
```jsx
function EmptyState({ title, description, actionLabel, onAction, icon }) {
  return (
    <div className="text-center py-12 px-4">
      {icon && <div className="mx-auto mb-3 opacity-50">{icon}</div>}
      <h3 className="text-base font-medium text-gray-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">{description}</p>}
      {onAction && (
        <button onClick={onAction} className="h-10 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
```

### Copy by Context

| Context | Don't | Do |
|---------|-------|----|
| First time | "No items found." | "Your research starts here. Add your first source." |
| Search | "No results." | "No matches for 'Kuberntes' — check spelling?" |
| Filter | "Nothing matches." | "No sources match these filters. Clear all?" |
| System error | "Something went wrong." | "Couldn't load sources. Check connection and retry." |
| Permission | "Access denied." | "This requires a Pro plan. Upgrade to unlock." |
| Completion | "No more items." | "All caught up! Add more sources to keep going." |

## Element States

```jsx
// HIDE — permanently unavailable
{user.isAdmin && <button>Admin Panel</button>}

// DISABLE — contextually unavailable
<button disabled={!formValid}
  className={formValid ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}>
  Save
</button>

// MARK — requires action
<button className="flex items-center gap-2">
  Premium Feature
  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">Pro</span>
</button>
```

## Functional Integrity

```jsx
// WRONG: Placeholder
<button onClick={() => console.log('TODO')}>Save</button>

// RIGHT: Only if backend exists
{hasBackendAPI && (
  <button onClick={async () => {
    await fetch('/api/save', { method: 'POST', body: JSON.stringify(formData) });
  }}>Save</button>
)}

// RIGHT: Demo mode clearly marked
<div className="border-2 border-amber-500 rounded-lg p-4">
  <p className="text-amber-700 text-xs font-medium">Demo mode - not connected to real data</p>
  <button onClick={handleMockSave}>Save (Demo Only)</button>
</div>
```

## Voice Calibration Reference

| Element | Pattern | Max | Example |
|---------|---------|-----|---------|
| Button | Verb + Object | ≤3 words | "Add Source" |
| Destructive | Verb + Object + consequence | ≤5 words | "Delete 3 sources" |
| Placeholder | Instruction + context | ≤4 words | "Search sources..." |
| Tooltip | "What does this do?" | ≤8 words | "Filter by document type" |
| Loading | Action + count | ≤5 words | "Analyzing 3 sources..." |
| Success | What + delta | ≤8 words | "Source added to research" |
| Error (inline) | What wrong + fix | ≤12 words | "File too large. Max 25MB." |

**Tone ladder:** Neutral (default) → Encouraging (first-time) → Urgent (errors/destructive) → Celebratory (completion)

**Destructive confirmation:**
```jsx
<dialog>
  <h3>Delete 3 sources?</h3>
  <p>This can't be undone. Summaries using these sources will be affected.</p>
  <div className="flex gap-2">
    <button>Cancel</button>
    <button className="bg-red-600 text-white">Delete Sources</button>
  </div>
</dialog>
```

## Mobile Patterns

### Mobile-First Classes
```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
<div class="flex flex-col md:flex-row">
```
Base = mobile. Breakpoints add complexity.

### Touch Targets
```html
<button class="w-11 h-11 flex items-center justify-center"><Icon size={16} /></button>
<button class="h-11 px-4 text-sm font-medium">Action</button>
<button class="h-12 w-full text-sm font-medium">Primary Action</button>
```

### Truncation
```html
<h3 class="line-clamp-2 md:line-clamp-none">
<p class="line-clamp-2 md:line-clamp-3 lg:line-clamp-none">
```

### Limited Items + Count
```jsx
{tags.slice(0, 2).map(tag => <Tag>{tag}</Tag>)}
{tags.length > 2 && <span class="text-xs text-gray-500">+{tags.length - 2}</span>}
```

### Action Stacking
Primary: `w-full h-12` mobile. Secondary: `flex gap-2`, each `flex-1 h-10`. Desktop: `flex-col md:flex-row`.

### Input Sizing
≥16px font on mobile: `h-11 px-4 text-base rounded-xl`

### Safe Area
`pb-6` or `padding-bottom: max(1.5rem, env(safe-area-inset-bottom))`

### Active States
`active:bg-blue-700` (primary), `active:bg-gray-200` (secondary)

### Mobile Enhancements
- **Swipe:** Right = positive (save), Left = negative (delete). 80px threshold. Haptic on trigger.
- **Bottom Sheet:** Detail views, action menus >3 options. Small (40vh), Medium (60vh), Large (85vh). Thumb-friendly, preserves context.
- **Pull to Refresh:** Scrollable updating lists. 60px threshold.
- **Overflow:** Fade gradient `bg-gradient-to-l from-white to-transparent pointer-events-none` for horizontal scroll.

### Full Mobile Card
```jsx
function MobileCard({ item, isInteractive = true }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 space-y-3
      transition-all duration-200 ease-out
      ${isInteractive ? 'hover:-translate-y-0.5 hover:shadow-lg cursor-pointer active:scale-[0.98]' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{item.source}</span>
          <span className="text-gray-300">·</span>
          <span className="text-sm text-gray-500">{item.time}</span>
        </div>
        <button className="w-10 h-10 flex items-center justify-center text-gray-400 -mr-2">
          <ExternalLink size={16} />
        </button>
      </div>
      <h3 className="text-base font-semibold line-clamp-2 md:line-clamp-none">{item.title}</h3>
      <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
      <div className="flex items-center gap-1.5">
        {item.tags.slice(0, 2).map((tag, i) => (
          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700
            transition-all duration-300"
            style={{ transitionDelay: `${i * 60}ms` }}>{tag}</span>
        ))}
        {item.tags.length > 2 && <span className="text-xs text-gray-500">+{item.tags.length - 2}</span>}
      </div>
      {item.metric && (
        <div className="text-right">
          <span className="text-sm font-bold text-blue-600">{item.metric.value}</span>
          {item.metric.label && <p className="text-[10px] text-gray-400 mt-0.5">{item.metric.label}</p>}
        </div>
      )}
      <div className="flex flex-col gap-2 pt-1">
        <button className="w-full h-12 bg-blue-600 text-white rounded-xl text-sm font-medium active:bg-blue-700">
          Primary Action
        </button>
        <div className="flex gap-2">
          <button className="flex-1 h-10 bg-gray-100 rounded-lg text-sm font-medium active:bg-gray-200">Secondary</button>
          <button className="flex-1 h-10 bg-gray-100 rounded-lg text-sm font-medium active:bg-gray-200">Tertiary</button>
        </div>
      </div>
    </div>
  );
}
```

## Grouped Container

```
SECTION HEADER (11px uppercase, gray-500)
┌─────────────────────────────────┐  ← Single border
│ Title            │    Metadata  │
│ Description      │              │
├─────────────────────────────────┤  ← Divider (1px, gradient, or ≥24px gap)
│ Title 2          │    Metadata  │
│ Description      │              │
└─────────────────────────────────┘
```

Group when: items share type, user scans multiple, actions apply to group.
Don't group: items distinct, 1-2 items, single item focus.

## Status Indication

Text color only (no background boxes):
Success `green-600` | Warning `amber-600` | Info `blue-600` | Error `red-600` | Neutral `gray-600`
Exception: removable filter chips need subtle background (tap target).

## Loading States

Skeleton: match three-line pattern, subtle shimmer (1.5s), max 5 items, progressive stagger (50-100ms).
Copy: "Analyzing 3 sources..." not "Loading..."
