#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "xcodebuild is missing. Install Xcode and select it with xcode-select." >&2
  exit 1
fi

if ! command -v xcrun >/dev/null 2>&1; then
  echo "xcrun is missing. Install Xcode command line tools." >&2
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

if ! RUNTIME_OUTPUT="$(xcrun simctl list runtimes available 2>&1)"; then
  echo "Unable to query iOS simulator runtimes. CoreSimulatorService or the iOS simulator runtime is unavailable." >&2
  echo "$RUNTIME_OUTPUT" >&2
  RUNTIME_OUTPUT=""
fi

DESTINATIONS_OUTPUT="$(xcodebuild -project NearMind.xcodeproj -scheme NearMind -showdestinations 2>&1 || true)"

if ! SIMCTL_OUTPUT="$(xcrun simctl list devices available 2>&1)"; then
  echo "Unable to query iOS simulators. CoreSimulatorService or the iOS simulator runtime is unavailable." >&2
  echo "$SIMCTL_OUTPUT" >&2
  SIMCTL_OUTPUT=""
fi

DESTINATION_NAME="$(
  printf '%s\n' "$SIMCTL_OUTPUT" |
  sed -nE 's/^[[:space:]]+(iPhone[^()]*) \(([A-F0-9-]+)\) \((Booted|Shutdown)\)$/\1/p' |
  head -n 1 |
  sed 's/[[:space:]]*$//'
)"

if [[ -z "$DESTINATION_NAME" ]]; then
  DESTINATION_NAME="$(
    printf '%s\n' "$DESTINATIONS_OUTPUT" |
    sed -nE 's/.*platform:iOS Simulator.*name:([^,}]+).*/\1/p' |
    sed 's/^[[:space:]]*//' |
    sed 's/[[:space:]]*$//' |
    sed -n '/^iPhone/p' |
    head -n 1
  )"
fi

if [[ -z "$DESTINATION_NAME" ]]; then
  echo "Available destinations:" >&2
  printf '%s\n' "$DESTINATIONS_OUTPUT" >&2
  echo "No iOS simulator runtime/device installed. Install via Xcode → Settings → Platforms." >&2
  exit 1
fi

DESTINATION="platform=iOS Simulator,name=${DESTINATION_NAME}"
echo "Building NearMind for destination: $DESTINATION"

xcodebuild \
  -project NearMind.xcodeproj \
  -scheme NearMind \
  -destination "$DESTINATION" \
  CODE_SIGNING_ALLOWED=NO \
  build
