#!/bin/bash
# deploy-testflight.sh — Full iOS deploy pipeline: bump → build → commit → push → archive → upload
# Usage: deploy-testflight.sh [--bump-type patch|minor|major] [--message "commit message"]
#
# Reads credentials from memory: ~/.claude/projects/-Users-tyroneross/memory/reference_asc_credentials.md
# Requires: xcodegen, xcodebuild, git, project.yml in current directory

set -euo pipefail

# --- Config (from ASC credentials memory) ---
TEAM_ID="Q6TB8685V9"
KEY_PATH="$HOME/.private_keys/AuthKey_NTNAA84KU6.p8"
KEY_ID="NTNAA84KU6"
ISSUER_ID="8a719415-b66b-4c54-b426-b7a7e8515878"
EXPORT_PLIST="/tmp/ExportOptions.plist"
ARCHIVE_PATH="/tmp/$(basename $PWD).xcarchive"
EXPORT_PATH="/tmp/$(basename $PWD)-export"

# --- Args ---
BUMP_TYPE="${1:-patch}"
COMMIT_MSG="${2:-""}"

# --- Ensure ExportOptions.plist exists ---
if [ ! -f "$EXPORT_PLIST" ]; then
cat > "$EXPORT_PLIST" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key><string>app-store-connect</string>
    <key>teamID</key><string>Q6TB8685V9</string>
    <key>signingStyle</key><string>automatic</string>
    <key>uploadSymbols</key><true/>
    <key>destination</key><string>upload</string>
</dict>
</plist>
PLIST
fi

# --- Detect scheme from project.yml ---
SCHEME=$(grep "^name:" project.yml | head -1 | awk '{print $2}')
if [ -z "$SCHEME" ]; then
    echo "ERROR: Could not detect scheme from project.yml"
    exit 1
fi

# --- Read current version ---
CURRENT_BUILD=$(grep "CURRENT_PROJECT_VERSION" project.yml | head -1 | awk -F'"' '{print $2}')
CURRENT_VERSION=$(grep "MARKETING_VERSION" project.yml | head -1 | awk -F'"' '{print $2}')

# --- Bump build number (always +1) ---
NEW_BUILD=$((CURRENT_BUILD + 1))

# --- Bump version ---
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
case "$BUMP_TYPE" in
    major) NEW_VERSION="$((MAJOR + 1)).0.0" ;;
    minor) NEW_VERSION="$MAJOR.$((MINOR + 1)).0" ;;
    patch) NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))" ;;
    *) NEW_VERSION="$CURRENT_VERSION" ;;
esac

echo "=== Deploy Pipeline ==="
echo "Scheme:  $SCHEME"
echo "Version: $CURRENT_VERSION → $NEW_VERSION (Build $CURRENT_BUILD → $NEW_BUILD)"
echo ""

# --- 1. Bump version in project.yml ---
sed -i '' "s/CURRENT_PROJECT_VERSION: \"$CURRENT_BUILD\"/CURRENT_PROJECT_VERSION: \"$NEW_BUILD\"/" project.yml
sed -i '' "s/MARKETING_VERSION: \"$CURRENT_VERSION\"/MARKETING_VERSION: \"$NEW_VERSION\"/" project.yml

# --- 2. Regenerate Xcode project ---
echo "[1/6] Regenerating project..."
xcodegen generate 2>&1 | tail -1

# --- 3. Build to verify ---
echo "[2/6] Building..."
xcodebuild -scheme "$SCHEME" -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -quiet build 2>&1 | tail -1
echo "BUILD SUCCEEDED"

# --- 4. Commit + push ---
echo "[3/6] Committing..."
git add -A
if [ -n "$COMMIT_MSG" ]; then
    git commit -m "$COMMIT_MSG

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
else
    git commit -m "chore: bump to v$NEW_VERSION (Build $NEW_BUILD)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
fi
git push origin main

# --- 5. Archive ---
echo "[4/6] Archiving..."
xcodebuild archive \
    -scheme "$SCHEME" \
    -destination 'generic/platform=iOS' \
    -archivePath "$ARCHIVE_PATH" \
    CODE_SIGN_STYLE=Automatic \
    DEVELOPMENT_TEAM="$TEAM_ID" \
    2>&1 | grep "ARCHIVE"

# --- 6. Upload to TestFlight ---
echo "[5/6] Uploading to TestFlight..."
rm -rf ~/Library/Application\ Support/com.apple.dt.Xcode.ITunesSoftwareService/CDUploads/ "$EXPORT_PATH" 2>/dev/null

xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportOptionsPlist "$EXPORT_PLIST" \
    -exportPath "$EXPORT_PATH" \
    -allowProvisioningUpdates \
    -authenticationKeyPath "$KEY_PATH" \
    -authenticationKeyID "$KEY_ID" \
    -authenticationKeyIssuerID "$ISSUER_ID" \
    2>&1 | grep -E "(Progress|Upload|EXPORT)" | tail -5

echo ""
echo "[6/6] Done! $SCHEME v$NEW_VERSION (Build $NEW_BUILD) uploaded to TestFlight."
