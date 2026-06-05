#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "xcodebuild is missing. Install Xcode and select it with xcode-select." >&2
  exit 1
fi

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "Xcode command line tools are unavailable. Run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer" >&2
  exit 1
fi

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "xcodegen is missing. Install it with: brew install xcodegen" >&2
  exit 1
fi

xcodegen generate

DESTINATION="generic/platform=iOS Simulator"
echo "Building NearMind for destination: $DESTINATION"

xcodebuild \
  -project NearMind.xcodeproj \
  -scheme NearMind \
  -destination "$DESTINATION" \
  CODE_SIGNING_ALLOWED=NO \
  build
