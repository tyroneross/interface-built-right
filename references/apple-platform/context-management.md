# Context Management for iOS Development Sessions

Long iOS sessions involve reading many Swift files across multiple targets (iOS, watchOS, macOS), platform-specific delegates, and shared code. Context fills fast. Use these three strategies together.

## Strategy 1: Tool-Result Clearing (Primary)

File reads dominate iOS development. Once code is analyzed, verbatim content can be re-fetched if needed.

**When it triggers:** Context hits ~150K tokens
**What happens:** Old file read results replaced with `[cleared to save context]`. Tool call records preserved (Claude knows what was read).

**Tuning for iOS:**
- `keep: 8-10` -- preserves recent file context for incremental edits
- `exclude_tools: ["memory"]` -- never clear memory operations
- After clearing, re-read only files actively being modified

```python
# API configuration (for apps using Claude API for iOS dev tooling)
context_management={
    "edits": [{
        "type": "clear_tool_uses_20250919",
        "trigger": {"type": "input_tokens", "value": 150_000},
        "keep": {"type": "tool_uses", "value": 8},
        "clear_at_least": {"type": "input_tokens", "value": 20_000},
        "exclude_tools": ["memory"],
    }]
}
```

## Strategy 2: Memory (Secondary)

Persist architectural decisions, dependency maps, and known issues across sessions.

**Structure for iOS projects:**
```
/memories/
  architecture.md      # Target structure, module boundaries, delegate pattern
  known-issues.md      # Bugs, workarounds, TODOs per target
  platform-diffs.md    # iOS vs macOS vs watchOS behavioral differences
  build-config.md      # Signing, entitlements, capabilities per target
```

**What to persist:**
- Target dependency graph (which targets depend on Shared/)
- Platform-specific conditional compilation decisions (`#if os()` rationale)
- Known SwiftData/CloudKit workarounds
- Watch connectivity channel decisions (why sendMessage vs transferUserInfo)
- Build configuration gotchas (entitlements, Info.plist keys)

**What NOT to persist (re-derive from code):**
- File contents
- Current implementation details
- Test results

## Strategy 3: Compaction (Tertiary)

For very long reasoning chains during architecture exploration.

```python
context_management={
    "edits": [{
        "type": "compact_20260112",
        "trigger": {"type": "input_tokens", "value": 400_000},
        "instructions": (
            "Preserve: all target names, file paths, iOS/macOS/watchOS "
            "conditionals, architecture decisions, delegate assignments, "
            "SwiftData model schemas, WCSession channel choices. "
            "Compress: exploratory discussion, intermediate attempts, "
            "verbose build output."
        ),
    }]
}
```

## Diagnostic: Which Strategy Targets Your Bottleneck?

| Symptom | Strategy |
|---------|----------|
| Reading same files repeatedly | **Clearing** (keep=8-10) |
| Long back-and-forth, reasoning piles up | **Compaction** (trigger=400K) |
| New session loses prior decisions | **Memory** (persist architecture) |
| All of the above (typical iOS dev) | **All three stacked** |

## Claude Code Session Tips

Within Claude Code (not API), context management is handled automatically. Maximize effectiveness by:

1. **Work in focused chunks** -- complete one feature/target before moving to next
2. **Use subagents for independent work** -- iOS delegate and watchOS delegate can be built in parallel subagents (isolated context)
3. **Reference files by path** -- "read iOS/Services/IOSEngineDelegate.swift" is cheaper than "find the iOS delegate"
4. **Commit checkpoints** -- after each major change, commit. Fresh context can re-derive state from git
5. **Offload to filesystem** -- write build scripts, test plans, architecture docs to files rather than keeping in conversation
