# Build Automation & Auto-Deploy

## Auto-Deploy on Major Commits

Push + deploy to Xcode Cloud (or TestFlight) automatically when significant changes are committed.

### Git Hook: post-commit Auto-Deploy

Install at `.git/hooks/post-commit`:

```bash
#!/bin/bash
# .git/hooks/post-commit — Auto-deploy to Xcode Cloud on major changes
set -euo pipefail

COMMIT_MSG=$(git log -1 --pretty=%B)
CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || git diff --name-only HEAD)
SWIFT_CHANGES=$(echo "$CHANGED_FILES" | grep -c "\.swift$" || true)
PLIST_CHANGES=$(echo "$CHANGED_FILES" | grep -c "Info\.plist\|\.entitlements\|project\.yml" || true)

# Determine if this is a major change
IS_MAJOR=false

# Trigger conditions for auto-deploy:
# 1. Commit message contains [deploy], [release], or [major]
if echo "$COMMIT_MSG" | grep -qiE '\[(deploy|release|major)\]'; then
    IS_MAJOR=true
fi

# 2. More than 5 Swift files changed
if [ "$SWIFT_CHANGES" -gt 5 ]; then
    IS_MAJOR=true
fi

# 3. Build config changed (project.yml, entitlements, plist)
if [ "$PLIST_CHANGES" -gt 0 ]; then
    IS_MAJOR=true
fi

# 4. Shared/ code changed (affects all platforms)
if echo "$CHANGED_FILES" | grep -q "^Shared/"; then
    IS_MAJOR=true
fi

if [ "$IS_MAJOR" = true ]; then
    echo "🚀 Major change detected — triggering deploy pipeline"

    # Option A: Push to trigger Xcode Cloud (if configured)
    BRANCH=$(git branch --show-current)
    if [ -n "$BRANCH" ]; then
        git push origin "$BRANCH" 2>/dev/null &
        echo "  Pushed to origin/$BRANCH (Xcode Cloud will pick up)"
    fi

    # Option B: Local build validation before push
    # Uncomment to run local build check first:
    # xcodebuild -scheme "MyApp-iOS" -destination "generic/platform=iOS" \
    #   -quiet build 2>&1 | tail -5
    # if [ $? -ne 0 ]; then
    #     echo "❌ Build failed — push cancelled"
    #     exit 1
    # fi

    echo "  Changed: $SWIFT_CHANGES Swift files, $PLIST_CHANGES config files"
    echo "  Commit: $(echo "$COMMIT_MSG" | head -1)"
else
    echo "📝 Minor change — no auto-deploy"
fi
```

Make executable: `chmod +x .git/hooks/post-commit`

### Claude Code Hook: Auto-Push on Commit

Add to `.claude/settings.json` to auto-push after Claude commits:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "if echo \"$CLAUDE_TOOL_INPUT\" | grep -q 'git commit'; then BRANCH=$(git branch --show-current); CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -c '\\.swift$' || echo 0); if [ \"$CHANGED\" -gt 5 ] || git log -1 --pretty=%B | grep -qiE '\\[(deploy|release|major)\\]'; then git push origin \"$BRANCH\" 2>/dev/null && echo 'Auto-pushed major change to origin'; fi; fi"
          }
        ]
      }
    ]
  }
}
```

### Xcode Cloud Configuration

Xcode Cloud triggers builds automatically on push. Configure in Xcode:

1. **Product > Xcode Cloud > Create Workflow**
2. Set trigger: **Push to branch** (main, develop, or feature/*)
3. Actions:
   - **Build** — all schemes (iOS, watchOS, macOS)
   - **Test** — unit test target
   - **Archive** — iOS + watchOS (bundles both)
   - **Deploy to TestFlight** — on main branch only

### Custom ci_scripts for Xcode Cloud

```bash
# ci_scripts/ci_post_clone.sh — Runs after Xcode Cloud clones repo
#!/bin/bash
set -euo pipefail

# Install XcodeGen if using project.yml
if [ -f "project.yml" ]; then
    brew install xcodegen
    xcodegen generate
    echo "✅ Generated Xcode project from project.yml"
fi

# Install SPM dependencies (if custom resolution needed)
# swift package resolve
```

```bash
# ci_scripts/ci_pre_xcodebuild.sh — Runs before each build action
#!/bin/bash
set -euo pipefail

echo "Building scheme: $CI_XCODEBUILD_ACTION"
echo "Platform: $CI_PRODUCT_PLATFORM"
echo "Commit: $CI_COMMIT"
```

```bash
# ci_scripts/ci_post_xcodebuild.sh — Runs after build completes
#!/bin/bash
set -euo pipefail

if [ "$CI_XCODEBUILD_EXIT_CODE" -ne 0 ]; then
    echo "❌ Build failed for $CI_XCODEBUILD_ACTION"
    # Could send notification here (Slack webhook, etc.)
    exit 1
fi

echo "✅ Build succeeded: $CI_XCODEBUILD_ACTION"

# Tag successful builds on main
if [ "$CI_BRANCH" = "main" ] && [ "$CI_XCODEBUILD_ACTION" = "archive" ]; then
    echo "📦 Archive ready for TestFlight distribution"
fi
```

### Fastlane Alternative (for non-Xcode Cloud)

```ruby
# Fastfile
default_platform(:ios)

platform :ios do
  desc "Build and deploy on major changes"
  lane :auto_deploy do
    # Check if major change
    changed = sh("git diff --name-only HEAD~1 HEAD").split("\n")
    swift_changes = changed.count { |f| f.end_with?(".swift") }

    if swift_changes > 5 || changed.any? { |f| f.include?("Shared/") }
      UI.important("Major change detected (#{swift_changes} Swift files)")

      # Build both targets
      build_app(
        scheme: "MyApp-iOS",
        export_method: "app-store",
        include_bitcode: false
      )

      # Upload to TestFlight
      upload_to_testflight(
        skip_waiting_for_build_processing: true
      )

      UI.success("Deployed to TestFlight!")
    else
      UI.message("Minor change — skipping deploy")
    end
  end
end
```

### GitHub Actions (if not using Xcode Cloud)

```yaml
# .github/workflows/ios-deploy.yml
name: iOS Auto-Deploy

on:
  push:
    branches: [main, develop]
    paths:
      - '**/*.swift'
      - '**/project.yml'
      - '**/Info.plist'
      - '**/*.entitlements'
      - 'Shared/**'

jobs:
  check-major:
    runs-on: ubuntu-latest
    outputs:
      is_major: ${{ steps.check.outputs.is_major }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2
      - id: check
        run: |
          SWIFT_CHANGES=$(git diff --name-only HEAD~1 HEAD | grep -c '\.swift$' || echo 0)
          SHARED_CHANGES=$(git diff --name-only HEAD~1 HEAD | grep -c '^Shared/' || echo 0)
          MSG=$(git log -1 --pretty=%B)
          if [ "$SWIFT_CHANGES" -gt 5 ] || [ "$SHARED_CHANGES" -gt 0 ] || echo "$MSG" | grep -qiE '\[(deploy|release|major)\]'; then
            echo "is_major=true" >> $GITHUB_OUTPUT
          else
            echo "is_major=false" >> $GITHUB_OUTPUT
          fi

  build-and-deploy:
    needs: check-major
    if: needs.check-major.outputs.is_major == 'true'
    runs-on: macos-15
    steps:
      - uses: actions/checkout@v4

      - name: Generate Xcode project
        if: hashFiles('project.yml') != ''
        run: |
          brew install xcodegen
          xcodegen generate

      - name: Build iOS
        run: |
          xcodebuild -scheme "MyApp-iOS" \
            -destination "generic/platform=iOS" \
            -archivePath build/MyApp.xcarchive \
            archive

      - name: Export IPA
        run: |
          xcodebuild -exportArchive \
            -archivePath build/MyApp.xcarchive \
            -exportPath build/export \
            -exportOptionsPlist ExportOptions.plist

      - name: Upload to TestFlight
        env:
          APP_STORE_CONNECT_API_KEY: ${{ secrets.ASC_API_KEY }}
        run: |
          xcrun altool --upload-app \
            --type ios \
            --file build/export/MyApp.ipa \
            --apiKey "$APP_STORE_CONNECT_API_KEY"
```

## Major Change Detection Rules

| Trigger | Rationale |
|---------|-----------|
| `[deploy]` / `[release]` / `[major]` in commit msg | Explicit developer intent |
| > 5 Swift files changed | Significant code change |
| Any `Shared/` file changed | Affects all platforms |
| `project.yml` / `Info.plist` / `.entitlements` changed | Build config change |
| Any `watchOS/` + `iOS/` files in same commit | Cross-platform change |

## Local Build Validation (Pre-Push)

Run before auto-push to catch build failures locally:

```bash
#!/bin/bash
# scripts/build-check.sh — Quick multi-target build validation
set -euo pipefail

echo "🔨 Building iOS..."
xcodebuild -scheme "MyApp-iOS" -destination "generic/platform=iOS" \
  -quiet build 2>&1 | tail -3

echo "⌚ Building watchOS..."
xcodebuild -scheme "MyApp-watchOS" -destination "generic/platform=watchOS" \
  -quiet build 2>&1 | tail -3

echo "🧪 Running tests..."
xcodebuild -scheme "MyApp-UnitTests" -destination "platform=macOS" \
  -quiet test 2>&1 | tail -5

echo "✅ All targets build and tests pass"
```
