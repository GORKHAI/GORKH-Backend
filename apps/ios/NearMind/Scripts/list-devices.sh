#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v xcrun >/dev/null 2>&1; then
  echo "xcrun is not available. Install Xcode and command line tools."
  exit 1
fi

echo "Physical iOS devices:"
physical_devices="$(xcrun xctrace list devices 2>/dev/null | sed -n '/^== Devices ==/,/^==/p' | sed -n '/iPhone\|iPad/p' | sed -n '/Simulator/!p' || true)"
if [ -z "$physical_devices" ]; then
  echo "No physical iOS device connected. Connect an iPhone/iPad and trust this Mac."
else
  echo "$physical_devices"
fi

echo
echo "Available iOS simulators:"
xcrun simctl list devices available 2>/dev/null | sed -n '/-- iOS /,/-- /p' || {
  echo "Could not query simulators. Check Xcode and CoreSimulatorService."
}
