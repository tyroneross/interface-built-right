# 2. Lists, Cards & Content

Option catalog for list row patterns, card styles, swipe actions, three-line hierarchy, and content resilience.

**Read first:** `0_Router.md`
**Companion:** CP 6.4.1 Principle 1 (Group, Don't Isolate)

---

## §1. LIST ROW SEPARATORS

### 1.1 Options

| Option | Description | Best For |
|--------|-------------|----------|
| **Card Per Row** | Each row is its own card with corner radius + bg | Independent entities (feed items, each navigable on its own) |
| **Full-Width Line** | Edge-to-edge hairline between rows | Logical sequences, uniform rows |
| **Inset Hairline** | Hairline inset 16pt from leading edge | iOS-native list style (Settings, Mail) |
| **No Separator (Whitespace Only)** | Relies on spacing alone | Editorial lists, minimal design |
| **Grouped Container** | Single border around section + dividers between | CP 6.4.1 preferred for related grouped items |
| **Alternating Background** | Zebra striping | Data-heavy tables (rare on mobile) |

### 1.2 Rossen Preferred

Card Per Row + Full-Width Line. Inset Hairline removed from preferred in v2 update.

### 1.3 List Pattern Decision Tree

```
What's in the list?
├── Rows are independent entities with rich metadata?
│   └── Card Per Row
├── Rows are uniform items in a sequence (messages, transactions)?
│   └── Full-Width Line
├── Settings/config with iOS-native feel?
│   └── Inset Hairline (system default)
├── Related items that form a group?
│   └── Grouped Container (CP 6.4.1 preferred)
├── Editorial/minimal aesthetic?
│   └── Whitespace Only
└── Data table / comparison grid?
    └── Full-Width Line or Alternating Background
```

### 1.4 CP 6.4.1 Consideration

**Principle 1 — Group, Don't Isolate:** Single border + dividers for related items.

When rows form a logical group, `Card Per Row` places visual weight on each row's isolation — which CP discourages. Three ways to resolve:

1. **Use Grouped Container** — single outer border, internal dividers
2. **Use Full-Width Line** if rows are sequential but related
3. **Use Card Per Row only when rows truly are independent** (each navigable, each self-contained)

### 1.5 SwiftUI Patterns

**Card Per Row:**
```swift
ScrollView {
    LazyVStack(spacing: 10) {
        ForEach(items) { item in
            CardRow(item: item)
                .padding(16)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }
    .padding(.horizontal)
}
```

**Full-Width Line:**
```swift
List {
    ForEach(items) { item in
        Row(item: item)
    }
}
.listStyle(.plain)  // edge-to-edge separators
```

**Inset Hairline:**
```swift
List {
    Section {
        ForEach(items) { item in Row(item: item) }
    }
}
.listStyle(.insetGrouped)  // native iOS inset style
```

**Grouped Container (CP-preferred for related items):**
```swift
VStack(spacing: 0) {
    ForEach(items) { item in
        Row(item: item)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        if item != items.last {
            Divider().padding(.leading, 16)
        }
    }
}
.background(Color(.secondarySystemBackground))
.clipShape(RoundedRectangle(cornerRadius: 12))
```

---

## §2. THREE-LINE CONTENT HIERARCHY

### 2.1 The Pattern (CP 6.4.1 Principle 3)

Every row/card with rich content follows:

| Line | Role | SwiftUI |
|------|------|---------|
| **Title** | Primary identifier. Bold, high contrast. | `.font(.headline)` + `.foregroundStyle(.primary)` |
| **Description** | What/why in plain language. Medium contrast. | `.font(.subheadline)` + `.foregroundStyle(.secondary)` |
| **Metadata** | Time, source, status. Low contrast. | `.font(.caption)` + `.foregroundStyle(.tertiary)` |

### 2.2 Spacing Between Lines

- Title → Description: 4pt
- Description → Metadata: 4pt
- Between rows (if Card Per Row): 10pt
- Between rows (if hairline): 0pt (hairline provides separation)

### 2.3 Mobile Truncation Rules

```
Mobile (compact width):
├── Title → line-limit 2
├── Description → line-limit 2
└── Metadata → line-limit 1

iPad (regular width):
├── Title → no limit or line-limit 3
├── Description → line-limit 3 or none
└── Metadata → no limit
```

```swift
Text(item.title)
    .lineLimit(2)
    .fixedSize(horizontal: false, vertical: true)
```

### 2.4 Four-Line Variant (When Warranted)

Some content needs a fourth line for trailing metadata (status, priority, count):

```
┌────────────────────────────────────────┐
│ Title                         12 items │  ← Title + trailing count
│ Description                            │
│ Metadata • Status            2m ago    │  ← Metadata + trailing time
└────────────────────────────────────────┘
```

Use when the fourth data point is functionally distinct (count, status). Don't use for decoration.

### 2.5 Three-Line Row Pattern

```swift
struct ThreeLineRow: View {
    let item: Item
    
    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            // Leading (avatar, icon, thumbnail)
            if let imageURL = item.imageURL {
                AsyncImage(url: imageURL) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color(.tertiarySystemFill)
                }
                .frame(width: 44, height: 44)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            
            // Content (three-line)
            VStack(alignment: .leading, spacing: 4) {
                Text(item.title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                
                if let description = item.description {
                    Text(description)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                
                HStack(spacing: 6) {
                    Text(item.timestamp, style: .relative)
                    if let source = item.source {
                        Text("•")
                        Text(source)
                    }
                }
                .font(.caption)
                .foregroundStyle(.tertiary)
            }
            
            Spacer(minLength: 0)
            
            // Trailing (value, chevron, badge)
            if let trailingValue = item.trailingValue {
                Text(trailingValue)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
        }
    }
}
```

---

## §3. CARD INTERACTIVITY

### 3.1 Card Types by Interactivity

| Type | Behavior | Visual Cue |
|------|----------|------------|
| **Non-Interactive (Display Only)** | Shows information only | No lift, no shadow change, no cursor |
| **Navigation Card** | Tap navigates to detail | Full lift on hover, press-in on mobile |
| **Action Card** | Contains internal buttons/toggles | Subtle lift (outer interactivity less prominent) |
| **Selectable Card** | Tap toggles selection state | Full lift + border/background accent change |
| **Expandable Card** | Tap expands inline | Lift + chevron rotation on expand |

### 3.2 Interaction Feedback Spec

**Desktop (iPad with pointer):**
| Type | Hover Effect |
|------|-------------|
| Non-interactive | None |
| Navigation | `hover:shadow-lg + translate(-2pt)` |
| Action | `hover:shadow-md + translate(-1pt)` |
| Selectable | Full lift + border accent |

**Mobile (iPhone):**
| Type | Press Effect |
|------|-------------|
| Non-interactive | None |
| Navigation | `scaleEffect(0.98)` on press |
| Action | `scaleEffect(0.99)` on press (outer), buttons handle their own |
| Selectable | `scaleEffect(0.98)` + bg flash |

### 3.3 Card Interactivity Decision Tree

```
Is the card tappable?
├── No (display only)
│   └── No lift, no shadow change, no pointer/press effect
├── Yes, navigates to detail view
│   └── Full lift (desktop) / scale 0.98 press (mobile)
├── Yes, contains inline actions (buttons inside)
│   └── Subtle lift only — don't compete with internal buttons
├── Yes, card IS the toggle (select/favorite)
│   └── Full lift + accent border on selected state
└── Yes, expands inline
    └── Lift + chevron rotation + height animation
```

### 3.4 SwiftUI Card Patterns

**Navigation Card:**
```swift
struct NavigationCard: View {
    let item: Item
    @State private var isPressed = false
    
    var body: some View {
        NavigationLink {
            DetailView(item: item)
        } label: {
            CardContent(item: item)
                .padding(16)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .scaleEffect(isPressed ? 0.98 : 1.0)
                .animation(.easeOut(duration: 0.15), value: isPressed)
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
    }
}
```

**Selectable Card:**
```swift
struct SelectableCard: View {
    let item: Item
    @Binding var isSelected: Bool
    
    var body: some View {
        CardContent(item: item)
            .padding(16)
            .background(
                isSelected ? Color.accentColor.opacity(0.08) : Color(.secondarySystemBackground)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? Color.accentColor : Color.clear, lineWidth: 2)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .onTapGesture {
                withAnimation(.easeOut(duration: 0.2)) { isSelected.toggle() }
            }
    }
}
```

---

## §4. SWIPE-TO-REVEAL ACTIONS

### 4.1 Options

| Option | Description | Best For |
|--------|-------------|----------|
| **Icon + Label Button** | Revealed button has icon + text label | Maximum clarity (Mail, Reminders) |
| **Icon Only Button** | Icon-only colored button | Compact, when action is obvious |
| **Full-Width Destructive** | Full swipe triggers immediate action | Power-user delete with undo |
| **Multi-Action Stack** | 2–3 actions revealed on swipe | Complex row actions |
| **No Swipe Actions** | Tap-only, actions via menu | When swipe is unreliable (drag-sort lists) |

### 4.2 Rossen Preferred

Icon + Label Button (standard actions) + Full-Width Destructive (for delete).

### 4.3 Swipe Conventions

Direction signals meaning:
- **Right swipe (leading → trailing)** — positive actions (save, archive, pin)
- **Left swipe (trailing → leading)** — negative actions (delete, remove)
- **Full left swipe** — destructive commit (delete) with undo snackbar

### 4.4 Swipe Action Decision Tree

```
Configuring swipe actions for a row?
├── Is there a destructive action?
│   ├── Yes, user-friendly (archive, hide) → Icon + Label, trailing edge
│   └── Yes, truly destructive (delete) → Full-Width Destructive + undo
├── Are there positive actions (save, favorite)?
│   └── Icon + Label, leading edge
├── Multiple actions needed?
│   ├── 2-3 on same side → Multi-Action Stack
│   └── 4+ → Use context menu instead (long-press), don't cram
└── Is this a sortable/drag list?
    └── Consider disabling swipe (conflicts with drag)
```

### 4.5 SwiftUI Pattern

```swift
List(items) { item in
    ItemRow(item: item)
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive) {
                delete(item)
                pendingUndo = item
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
        .swipeActions(edge: .trailing) {
            Button { archive(item) } label: {
                Label("Archive", systemImage: "archivebox")
            }
            .tint(.blue)
        }
        .swipeActions(edge: .leading) {
            Button { togglePin(item) } label: {
                Label(item.isPinned ? "Unpin" : "Pin", systemImage: "pin")
            }
            .tint(.orange)
        }
}
```

### 4.6 Undo Pattern (Required with Full-Width Destructive)

```swift
@State private var recentlyDeleted: Item?

.overlay(alignment: .bottom) {
    if let item = recentlyDeleted {
        UndoSnackbar(
            message: "\(item.name) deleted",
            action: { restore(item); recentlyDeleted = nil }
        )
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }
}
```

Show for 5 seconds minimum. Dismiss on tap-outside or Undo.

---

## §5. CONTENT RESILIENCE

### 5.1 CP 6.4.1 Principle 10

Every content-rendering component must handle:
- Null / missing values
- String OR structured object input
- Variable formats (markdown in some fields, plain text in others)
- Long text (truncation)
- Empty collections

### 5.2 Null/Missing Value Patterns

```swift
// Rendering an optional field
Text(item.description ?? "—")  // em-dash placeholder
    .foregroundStyle(item.description == nil ? .tertiary : .secondary)

// Fallback cascade through multiple field names
private var displayTitle: String {
    item.title ?? item.headline ?? item.name ?? "Untitled"
}

// Graceful partial rendering
VStack(alignment: .leading) {
    if let title = item.title {
        Text(title).font(.headline)
    }
    if let description = item.description {
        Text(description).font(.subheadline).foregroundStyle(.secondary)
    }
    if title == nil && description == nil {
        Text("No content available")
            .foregroundStyle(.tertiary)
    }
}
```

### 5.3 String vs. Structured Input

Some content might arrive as either a string or a structured object. Components should accept both:

```swift
enum ContentPayload {
    case plainText(String)
    case markdown(String)
    case structured(ContentItem)
}

struct FlexibleContentView: View {
    let payload: ContentPayload
    
    var body: some View {
        switch payload {
        case .plainText(let text):
            Text(text)
        case .markdown(let md):
            Text(try! AttributedString(markdown: md))
        case .structured(let item):
            StructuredContentView(item: item)
        }
    }
}
```

### 5.4 Empty List Handling

Lists should never render as blank space when empty. Always show an empty state (see `5_Motion_States_Identity.md` §Empty States).

```swift
Group {
    if items.isEmpty {
        ContentUnavailableView {
            Label("No Items Yet", systemImage: "tray")
        } description: {
            Text("Items will appear here as you add them.")
        }
    } else {
        List(items) { item in ItemRow(item: item) }
    }
}
```

### 5.5 Long Text Truncation

| Context | Strategy |
|---------|----------|
| Row description | `.lineLimit(2)` + `fixedSize(horizontal: false, vertical: true)` |
| Card title | `.lineLimit(2)` |
| Detail body | No limit — scrollable |
| Inline metadata | `.lineLimit(1)` + `.truncationMode(.tail)` |
| Name/identifier | `.lineLimit(1)` + `.truncationMode(.middle)` — keeps start + end visible |

---

## §6. CONTENT STRUCTURE PATTERNS

### 6.1 Feed Card (Content/Feed Archetype)

```
┌───────────────────────────────────────┐
│ [Source]  · 2h ago          [⋯ menu]  │  ← Metadata + actions
│                                       │
│ Title goes here, up to two lines     │  ← Headline (16pt bold)
│ wrapping nicely                       │
│                                       │
│ Description or excerpt, 2 lines max, │  ← Body (14pt regular)
│ gives user preview of content...      │
│                                       │
│ [tag1] [tag2] +3                      │  ← Tags/categories
│                                       │
│ ♡ 42    💬 7                          │  ← Actions
└───────────────────────────────────────┘
```

### 6.2 Task/Todo Row (Productivity Archetype)

```
┌───────────────────────────────────────┐
│ ○ Task title, one line               │
│   Optional description line           │
│   📅 Tomorrow  • High priority        │
└───────────────────────────────────────┘
```

### 6.3 Session Row (Utility Archetype)

```
┌───────────────────────────────────────┐
│ ● Focus          25m  |  2:30 PM     │  ← Mode + duration + time
└───────────────────────────────────────┘
```

### 6.4 Notification Row (Consumer/Habit)

```
┌───────────────────────────────────────┐
│ [avatar]  Someone did something       │  ← Natural language
│           Relevant context            │
│           2 min ago                   │
└───────────────────────────────────────┘
```

---

## §7. GROUPING PATTERNS

### 7.1 Section Headers

| Style | When |
|-------|------|
| **11pt uppercase gray-500** | CP default — system-style section headers |
| **Large section title (17pt bold)** | Editorial lists, profile screens |
| **Sticky section headers** | Long lists with logical sections (Contacts) |
| **No header** | When section is obvious from content |

### 7.2 Section Spacing

- Between sections: 20–24pt
- Between section header and first item: 8pt
- Within section: depends on separator choice (§1)

### 7.3 Collapsible Sections

Use for long lists with 3+ logical groups where users might want to hide some:

```swift
DisclosureGroup("Completed", isExpanded: $showCompleted) {
    ForEach(completedItems) { item in Row(item: item) }
}
```

---

## §8. PULL-TO-REFRESH

### 8.1 Options

| Option | Description | Best For |
|--------|-------------|----------|
| **System Spinner** | Native iOS refresh indicator | Default — when no signature design |
| **Progress Arc** | Arc draws 0–100% with pull, full circle triggers | Calm Precision preferred — tactile |
| **Logo / Brand Animation** | Custom branded animation during pull | Flagship screen of brand-expressive apps |
| **Inline Text** | "Release to refresh" / "Refreshing..." text | Editorial or minimal |
| **Hidden (Auto-Refresh)** | No visible indicator, content updates silently | Always-on data apps |

### 8.2 Rossen Preferred

Progress Arc (default) + Logo Animation (one flagship screen per app).

### 8.3 Pull-to-Refresh SwiftUI

```swift
ScrollView {
    LazyVStack { /* content */ }
}
.refreshable {
    await viewModel.refresh()
}
```

Custom Progress Arc requires replacing the default — use a custom scroll view with GeometryReader to track pull distance, then trigger refresh at 60pt threshold.

---

## §9. NOT YET IN CATALOG

Consider these per-app if relevant:

- **Drag-to-reorder** — use `.onMove(perform:)` with `EditButton`
- **Multi-select mode** — tap-and-hold or edit mode with checkboxes
- **Section index (A-Z sidebar)** — `List` with `ScrollViewReader` + index titles
- **Infinite scroll vs. paginated** — archetype-dependent (content/feed = infinite, productivity = paginated)
- **Virtual scrolling for 10,000+ items** — always `LazyVStack`, never `VStack`

---

*Lists, Cards & Content v1.0*
*Companion: CP 6.4.1 Principle 1, 3, 10*
