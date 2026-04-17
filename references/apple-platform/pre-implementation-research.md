# Pre-Implementation Research Protocol

Before any major change to an iOS/watchOS/macOS project, run structured research to understand impact and plan correctly. This prevents broken builds, platform-specific regressions, and architectural drift.

## What Triggers This Protocol

Any change that meets ONE or more:
- Touches `Shared/` code (affects all platforms)
- Adds or modifies a platform delegate
- Changes data models (`@Model`, database schema)
- Adds a new framework/capability (HealthKit, CloudKit, WatchConnectivity)
- Modifies build configuration (project.yml, entitlements, Info.plist)
- Adds a new target or extension (widget, complication, Live Activity)
- Refactors navigation or state management patterns

## Research Steps

### Step 1: Architecture Audit (File Exploration)

Map what exists before changing it.

**Files to read:**
```
Priority 1 (always):
  - Project config: project.yml OR *.xcodeproj/project.pbxproj
  - Entry points: iOS/App/*.swift, watchOS/App/*.swift, macOS/App/*.swift
  - Shared protocols: Shared/Protocols/*.swift (especially delegates)

Priority 2 (if touching affected area):
  - Data models: Shared/Models/*.swift
  - Services: Shared/Services/*.swift
  - Platform delegates: iOS/Services/*Delegate.swift, watchOS/Services/*Delegate.swift

Priority 3 (if touching sync/connectivity):
  - Watch sync: *SyncManager*.swift, *WatchSync*.swift
  - Local network: *LocalNetwork*.swift, *Bonjour*.swift
  - Cloud sync: *CloudSync*.swift, *SyncModels*.swift
```

**What to extract:**
- Current architecture pattern (delegate-based? direct? mixed?)
- Which targets depend on the files being changed
- State management approach (@Observable vs ObservableObject vs @Published)
- Data flow: how does data get from source to UI on each platform?
- Existing platform conditionals (`#if os()`) in affected code

### Step 2: Impact Analysis

For the proposed change, answer:

1. **Platform scope:** Which platforms are affected? (iOS only? All three? Watch + iOS?)
2. **Data model impact:** Does the change require schema migration? Is CloudKit involved?
3. **API availability:** Are the APIs available on all target platforms at the minimum deployment target?
4. **Delegate impact:** Does any platform delegate need updating?
5. **Test coverage:** Are there existing tests for the affected code? What new tests are needed?
6. **Entitlement/capability:** Does this require new entitlements or Info.plist keys?

### Step 3: Dependency Graph

Map the dependency chain for affected files:

```
[Changed File]
  └── Used by: [File A, File B]
       └── Used by: [View C, Delegate D]
            └── Platform: [iOS, watchOS]
```

Check for circular dependencies or tight coupling that would make the change risky.

## Research Output Format

Produce a structured summary:

```markdown
## Pre-Implementation Research: [Feature/Change Name]

### Affected Files
- [file path] — [what changes, why]

### Platform Impact
- iOS: [affected / not affected] — [details]
- watchOS: [affected / not affected] — [details]  
- macOS: [affected / not affected] — [details]

### API Availability
- [API/framework]: Available on [platforms] at [minimum version]
- Deployment target sufficient: [yes/no]

### Data Model Changes
- Schema migration needed: [yes/no]
- CloudKit compatible: [yes/no — all properties optional/defaulted?]
- Breaking change: [yes/no]

### Risks
1. [Risk description] — Mitigation: [approach]

### Implementation Order
1. [Step] — [which target/file]
2. [Step] — [which target/file]
3. Test: [what to verify]
```

## Parallel Execution Pattern

The research and version check are independent. Run them as parallel subagents:

```
┌─────────────────────────┐    ┌─────────────────────────┐
│  Subagent 1: Research   │    │  Subagent 2: Version    │
│                         │    │                         │
│  1. Read project config │    │  1. Run version check   │
│  2. Read affected files │    │     script              │
│  3. Map dependencies    │    │  2. Check API avail     │
│  4. Produce impact      │    │     for proposed change │
│     analysis            │    │  3. Flag deprecations   │
│                         │    │                         │
│  Output: research.md    │    │  Output: versions.md    │
└────────────┬────────────┘    └────────────┬────────────┘
             │                              │
             └──────────┬───────────────────┘
                        │
              ┌─────────▼─────────┐
              │  Main: Synthesize │
              │                   │
              │  Merge research + │
              │  version info     │
              │  → Plan impl      │
              └───────────────────┘
```

### Subagent 1: Architecture Research

Prompt template for the research subagent:

```
Explore the iOS/watchOS project at [PROJECT_PATH]. I need to understand
the impact of [PROPOSED CHANGE] before implementing it.

Read these files in order:
1. Project config (project.yml or *.xcodeproj)
2. All files in Shared/Protocols/ and Shared/Models/
3. The specific files that will be modified: [FILE LIST]
4. Platform delegates that may need updating

For each file, note:
- What it does and what depends on it
- Platform availability (#if os() guards)
- State management pattern used
- Any TODOs, workarounds, or complexity

Produce a structured impact analysis covering: affected platforms,
data model changes, API availability, risks, and recommended
implementation order.
```

### Subagent 2: Version & Compatibility Check

Prompt template for the version check subagent:

```
Run the version check script and analyze compatibility for [PROPOSED CHANGE]:

1. Execute: bash [SKILL_PATH]/scripts/apple-version-check.sh [PROJECT_PATH]
2. For the proposed change, verify:
   - Required APIs are available at current deployment targets
   - No deprecated APIs are being newly adopted
   - Swift language features used are available in project's Swift version
3. If targeting new APIs, note minimum OS version required

Report: current versions, compatibility status, and any version-related
blockers or recommendations.
```

## When NOT to Research

Skip this protocol for:
- Fixing a typo or string change
- Adding a single view that doesn't affect other platforms
- Updating comments or documentation
- Running tests or builds
- Changes fully contained within a single platform folder (e.g., only iOS/Views/)
