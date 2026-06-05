#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v xcrun >/dev/null 2>&1; then
  echo "xcrun is missing. Install Xcode command line tools." >&2
  exit 1
fi

echo "Available iOS simulator runtimes:"
if ! xcrun simctl list runtimes available | sed -n '/iOS/p'; then
  echo "Unable to query simulator runtimes with simctl." >&2
fi

echo
echo "Available iPhone simulator devices:"
if ! xcrun simctl list devices available | sed -nE 's/^[[:space:]]+(iPhone[^()]*) \(([A-F0-9-]+)\) \((Booted|Shutdown)\)$/\1 (\2) [\3]/p'; then
  echo "Unable to query simulator devices with simctl." >&2
fi

if command -v xcodebuild >/dev/null 2>&1 && [[ -d NearMind.xcodeproj ]]; then
  echo
  echo "Xcode destinations:"
  xcodebuild -project NearMind.xcodeproj -scheme NearMind -showdestinations
fi
