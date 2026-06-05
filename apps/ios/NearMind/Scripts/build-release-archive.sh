#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

archive_path="${ARCHIVE_PATH:-$PWD/build/NearMind.xcarchive}"

echo "Creating local NearMind archive at: $archive_path"
echo "This script does not upload to App Store Connect."

set +e
xcodebuild \
  -project NearMind.xcodeproj \
  -scheme NearMind \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$archive_path" \
  archive
status=$?
set -e

if [ "$status" -ne 0 ]; then
  echo
  echo "Release archive failed."
  echo "Configure signing in Xcode first: select NearMind target, set Team, verify bundle identifier ai.nearmind.app, then rerun this script."
  exit "$status"
fi

echo "Release archive created: $archive_path"
