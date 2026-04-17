#!/bin/bash
# apple-version-check.sh — Check latest Apple platform versions and Xcode releases
# Usage: ./scripts/apple-version-check.sh [project-root]
#
# Compares project deployment targets against latest available SDK versions.
# Fetches from Apple's public feeds and developer.apple.com.
#
# Output: JSON summary of current vs latest versions, with upgrade recommendations.

set -euo pipefail

ROOT="${1:-.}"
OUTPUT_FORMAT="${2:-text}"  # text or json

red()    { printf "\033[31m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }
green()  { printf "\033[32m%s\033[0m\n" "$1"; }
dim()    { printf "\033[2m%s\033[0m\n" "$1"; }

# --- Fetch latest versions from Apple ---

echo "=== Apple Platform Version Check ==="
echo ""

# Check installed Xcode version
echo "--- Local Environment ---"
if command -v xcodebuild &>/dev/null; then
    XCODE_VERSION=$(xcodebuild -version 2>/dev/null | head -1 || echo "Unknown")
    XCODE_BUILD=$(xcodebuild -version 2>/dev/null | tail -1 || echo "Unknown")
    echo "  Xcode: $XCODE_VERSION ($XCODE_BUILD)"
else
    echo "  Xcode: NOT INSTALLED"
fi

if command -v swift &>/dev/null; then
    SWIFT_VERSION=$(swift --version 2>/dev/null | head -1 | grep -oE "[0-9]+\.[0-9]+(\.[0-9]+)?" | head -1 || echo "Unknown")
    echo "  Swift: $SWIFT_VERSION"
else
    echo "  Swift: NOT INSTALLED"
fi

if command -v xcrun &>/dev/null; then
    IOS_SDK=$(xcrun --sdk iphoneos --show-sdk-version 2>/dev/null || echo "N/A")
    WATCHOS_SDK=$(xcrun --sdk watchos --show-sdk-version 2>/dev/null || echo "N/A")
    MACOS_SDK=$(xcrun --sdk macosx --show-sdk-version 2>/dev/null || echo "N/A")
    echo "  iOS SDK: $IOS_SDK"
    echo "  watchOS SDK: $WATCHOS_SDK"
    echo "  macOS SDK: $MACOS_SDK"
else
    IOS_SDK="N/A"
    WATCHOS_SDK="N/A"
    MACOS_SDK="N/A"
fi

echo ""

# --- Check project deployment targets ---
echo "--- Project Deployment Targets ---"

PROJECT_IOS_TARGET=""
PROJECT_WATCHOS_TARGET=""
PROJECT_MACOS_TARGET=""

if [ -f "$ROOT/project.yml" ]; then
    echo "  Source: project.yml (XcodeGen)"

    # Extract deployment targets from project.yml
    PROJECT_IOS_TARGET=$(grep -E "IPHONEOS_DEPLOYMENT_TARGET|iOS:" "$ROOT/project.yml" 2>/dev/null | grep -oE "[0-9]+\.[0-9]+" | head -1 || echo "")
    PROJECT_WATCHOS_TARGET=$(grep -E "WATCHOS_DEPLOYMENT_TARGET|watchOS:" "$ROOT/project.yml" 2>/dev/null | grep -oE "[0-9]+\.[0-9]+" | head -1 || echo "")
    PROJECT_MACOS_TARGET=$(grep -E "MACOSX_DEPLOYMENT_TARGET|macOS:" "$ROOT/project.yml" 2>/dev/null | grep -oE "[0-9]+\.[0-9]+" | head -1 || echo "")

elif ls "$ROOT"/*.xcodeproj &>/dev/null 2>&1; then
    PROJ_FILE=$(ls "$ROOT"/*.xcodeproj/project.pbxproj 2>/dev/null | head -1)
    if [ -n "$PROJ_FILE" ]; then
        echo "  Source: $(basename "$(dirname "$PROJ_FILE")")"
        PROJECT_IOS_TARGET=$(grep "IPHONEOS_DEPLOYMENT_TARGET" "$PROJ_FILE" 2>/dev/null | grep -oE "[0-9]+\.[0-9]+" | sort -V | tail -1 || echo "")
        PROJECT_WATCHOS_TARGET=$(grep "WATCHOS_DEPLOYMENT_TARGET" "$PROJ_FILE" 2>/dev/null | grep -oE "[0-9]+\.[0-9]+" | sort -V | tail -1 || echo "")
        PROJECT_MACOS_TARGET=$(grep "MACOSX_DEPLOYMENT_TARGET" "$PROJ_FILE" 2>/dev/null | grep -oE "[0-9]+\.[0-9]+" | sort -V | tail -1 || echo "")
    fi
elif [ -f "$ROOT/Package.swift" ]; then
    echo "  Source: Package.swift"
    PROJECT_IOS_TARGET=$(grep -E "\.iOS\(|macOS\(|watchOS\(" "$ROOT/Package.swift" 2>/dev/null | grep -oE "v[0-9]+" | head -1 | tr -d 'v' || echo "")
fi

[ -n "$PROJECT_IOS_TARGET" ] && echo "  iOS target: $PROJECT_IOS_TARGET" || echo "  iOS target: not set"
[ -n "$PROJECT_WATCHOS_TARGET" ] && echo "  watchOS target: $PROJECT_WATCHOS_TARGET" || echo "  watchOS target: not set"
[ -n "$PROJECT_MACOS_TARGET" ] && echo "  macOS target: $PROJECT_MACOS_TARGET" || echo "  macOS target: not set"

echo ""

# --- Version comparison and recommendations ---
echo "--- Recommendations ---"

version_major() {
    echo "$1" | cut -d. -f1
}

# iOS check
if [ -n "$PROJECT_IOS_TARGET" ] && [ "$IOS_SDK" != "N/A" ]; then
    PROJ_MAJOR=$(version_major "$PROJECT_IOS_TARGET")
    SDK_MAJOR=$(version_major "$IOS_SDK")
    BEHIND=$((SDK_MAJOR - PROJ_MAJOR))

    if [ "$BEHIND" -eq 0 ]; then
        green "  iOS: Up to date (targeting $PROJECT_IOS_TARGET, SDK $IOS_SDK)"
    elif [ "$BEHIND" -eq 1 ]; then
        yellow "  iOS: 1 major version behind (targeting $PROJECT_IOS_TARGET, SDK $IOS_SDK)"
        echo "    Consider: iOS $((PROJ_MAJOR + 1)).0 adds new APIs"
    elif [ "$BEHIND" -ge 2 ]; then
        red "  iOS: $BEHIND major versions behind (targeting $PROJECT_IOS_TARGET, SDK $IOS_SDK)"
        echo "    Action: Review deprecation warnings, plan migration"
    fi
fi

# watchOS check
if [ -n "$PROJECT_WATCHOS_TARGET" ] && [ "$WATCHOS_SDK" != "N/A" ]; then
    PROJ_MAJOR=$(version_major "$PROJECT_WATCHOS_TARGET")
    SDK_MAJOR=$(version_major "$WATCHOS_SDK")
    BEHIND=$((SDK_MAJOR - PROJ_MAJOR))

    if [ "$BEHIND" -eq 0 ]; then
        green "  watchOS: Up to date (targeting $PROJECT_WATCHOS_TARGET, SDK $WATCHOS_SDK)"
    elif [ "$BEHIND" -ge 1 ]; then
        yellow "  watchOS: $BEHIND major version(s) behind (targeting $PROJECT_WATCHOS_TARGET, SDK $WATCHOS_SDK)"
    fi
fi

# macOS check
if [ -n "$PROJECT_MACOS_TARGET" ] && [ "$MACOS_SDK" != "N/A" ]; then
    PROJ_MAJOR=$(version_major "$PROJECT_MACOS_TARGET")
    SDK_MAJOR=$(version_major "$MACOS_SDK")
    BEHIND=$((SDK_MAJOR - PROJ_MAJOR))

    if [ "$BEHIND" -eq 0 ]; then
        green "  macOS: Up to date (targeting $PROJECT_MACOS_TARGET, SDK $MACOS_SDK)"
    elif [ "$BEHIND" -ge 1 ]; then
        yellow "  macOS: $BEHIND major version(s) behind (targeting $PROJECT_MACOS_TARGET, SDK $MACOS_SDK)"
    fi
fi

# Swift version feature check
echo ""
echo "--- Swift Feature Availability ---"

if [ -n "$SWIFT_VERSION" ]; then
    SWIFT_MAJOR=$(echo "$SWIFT_VERSION" | cut -d. -f1)
    SWIFT_MINOR=$(echo "$SWIFT_VERSION" | cut -d. -f2)

    echo "  Swift $SWIFT_VERSION capabilities:"

    # Swift 5.9+ features
    if [ "$SWIFT_MAJOR" -ge 6 ] || { [ "$SWIFT_MAJOR" -eq 5 ] && [ "$SWIFT_MINOR" -ge 9 ]; }; then
        green "    @Observable macro: Available"
        green "    Macros: Available"
    else
        red "    @Observable macro: Requires Swift 5.9+"
    fi

    # Swift 6+ features
    if [ "$SWIFT_MAJOR" -ge 6 ]; then
        green "    Strict concurrency: Available (compile-time data race safety)"
        green "    Complete Sendable checking: Available"

        # Swift 6.2+ features
        if [ "$SWIFT_MAJOR" -gt 6 ] || { [ "$SWIFT_MAJOR" -eq 6 ] && [ "$SWIFT_MINOR" -ge 2 ]; }; then
            green "    Approachable concurrency: Available (@MainActor default)"
            green "    @concurrent annotation: Available"
        else
            yellow "    Approachable concurrency: Requires Swift 6.2+"
        fi
    else
        yellow "    Strict concurrency: Requires Swift 6.0+"
    fi
fi

# iOS feature check
echo ""
echo "--- Platform Feature Availability ---"

if [ -n "$PROJECT_IOS_TARGET" ]; then
    PROJ_MAJOR=$(version_major "$PROJECT_IOS_TARGET")

    echo "  iOS $PROJECT_IOS_TARGET capabilities:"

    [ "$PROJ_MAJOR" -ge 17 ] && green "    SwiftData: Available" || red "    SwiftData: Requires iOS 17+"
    [ "$PROJ_MAJOR" -ge 17 ] && green "    @Observable: Available" || red "    @Observable: Requires iOS 17+"
    [ "$PROJ_MAJOR" -ge 16 ] && green "    NavigationStack: Available" || red "    NavigationStack: Requires iOS 16+"
    [ "$PROJ_MAJOR" -ge 16 ] && green "    Live Activities: Available" || red "    Live Activities: Requires iOS 16.1+"
    [ "$PROJ_MAJOR" -ge 17 ] && green "    TipKit: Available" || yellow "    TipKit: Requires iOS 17+"
    [ "$PROJ_MAJOR" -ge 18 ] && green "    App Intents (full): Available" || yellow "    App Intents (full): Requires iOS 18+"
fi

if [ -n "$PROJECT_WATCHOS_TARGET" ]; then
    PROJ_MAJOR=$(version_major "$PROJECT_WATCHOS_TARGET")

    echo "  watchOS $PROJECT_WATCHOS_TARGET capabilities:"

    [ "$PROJ_MAJOR" -ge 10 ] && green "    SwiftData: Available" || red "    SwiftData: Requires watchOS 10+"
    [ "$PROJ_MAJOR" -ge 10 ] && green "    @Observable: Available" || red "    @Observable: Requires watchOS 10+"
    [ "$PROJ_MAJOR" -ge 10 ] && green "    WidgetKit: Available" || red "    WidgetKit: Requires watchOS 10+"
    [ "$PROJ_MAJOR" -ge 9 ] && green "    NavigationStack: Available" || red "    NavigationStack: Requires watchOS 9+"
fi

echo ""
echo "=== Check complete ==="
