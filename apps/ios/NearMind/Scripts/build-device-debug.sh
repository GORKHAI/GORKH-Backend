#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

destination="${DESTINATION:-generic/platform=iOS}"

echo "Building NearMind for device debug destination: $destination"
echo "Code signing uses local Xcode project settings. Set DEVELOPMENT_TEAM locally if signing fails."

set +e
xcodebuild \
  -project NearMind.xcodeproj \
  -scheme NearMind \
  -configuration Debug \
  -destination "$destination" \
  build
status=$?
set -e

if [ "$status" -ne 0 ]; then
  echo
  echo "Device debug build failed."
  echo "If this is a signing/device issue, open NearMind.xcodeproj in Xcode, select your team, connect a trusted iPhone, then rerun:"
  echo "  DESTINATION='platform=iOS,id=<device-udid>' ./Scripts/build-device-debug.sh"
  exit "$status"
fi

echo "Device debug build passed."
