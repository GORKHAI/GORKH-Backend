#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

source_icon="NearMind/Resources/Assets.xcassets/NearMindIconSource.imageset/near-mind-icon-source.png"
iconset="NearMind/Resources/Assets.xcassets/AppIcon.appiconset"

if [ ! -f "$source_icon" ]; then
  echo "Missing logo source: $source_icon"
  echo "Copy near-mind-icon-source.png into NearMindIconSource.imageset first."
  exit 1
fi

if ! command -v sips >/dev/null 2>&1; then
  echo "sips is not available; cannot generate AppIcon locally."
  exit 1
fi

width="$(sips -g pixelWidth "$source_icon" 2>/dev/null | awk '/pixelWidth/ {print $2}')"
height="$(sips -g pixelHeight "$source_icon" 2>/dev/null | awk '/pixelHeight/ {print $2}')"

mkdir -p "$iconset"

if [ "$width" != "$height" ]; then
  echo "Source logo is not square (${width}x${height}). Provide a square icon source or manually create a padded #06402B square asset."
  exit 1
fi

make_icon() {
  local filename="$1"
  local pixels="$2"
  sips -z "$pixels" "$pixels" "$source_icon" --out "$iconset/$filename" >/dev/null
}

make_icon "Icon-20@2x.png" 40
make_icon "Icon-20@3x.png" 60
make_icon "Icon-29@2x.png" 58
make_icon "Icon-29@3x.png" 87
make_icon "Icon-40@2x.png" 80
make_icon "Icon-40@3x.png" 120
make_icon "Icon-60@2x.png" 120
make_icon "Icon-60@3x.png" 180
make_icon "Icon-20-ipad.png" 20
make_icon "Icon-20-ipad@2x.png" 40
make_icon "Icon-29-ipad.png" 29
make_icon "Icon-29-ipad@2x.png" 58
make_icon "Icon-40-ipad.png" 40
make_icon "Icon-40-ipad@2x.png" 80
make_icon "Icon-76-ipad.png" 76
make_icon "Icon-76-ipad@2x.png" 152
make_icon "Icon-83.5-ipad@2x.png" 167
make_icon "Icon-1024.png" 1024

cat > "$iconset/Contents.json" <<'JSON'
{
  "images" : [
    { "filename" : "Icon-20@2x.png", "idiom" : "iphone", "scale" : "2x", "size" : "20x20" },
    { "filename" : "Icon-20@3x.png", "idiom" : "iphone", "scale" : "3x", "size" : "20x20" },
    { "filename" : "Icon-29@2x.png", "idiom" : "iphone", "scale" : "2x", "size" : "29x29" },
    { "filename" : "Icon-29@3x.png", "idiom" : "iphone", "scale" : "3x", "size" : "29x29" },
    { "filename" : "Icon-40@2x.png", "idiom" : "iphone", "scale" : "2x", "size" : "40x40" },
    { "filename" : "Icon-40@3x.png", "idiom" : "iphone", "scale" : "3x", "size" : "40x40" },
    { "filename" : "Icon-60@2x.png", "idiom" : "iphone", "scale" : "2x", "size" : "60x60" },
    { "filename" : "Icon-60@3x.png", "idiom" : "iphone", "scale" : "3x", "size" : "60x60" },
    { "filename" : "Icon-20-ipad.png", "idiom" : "ipad", "scale" : "1x", "size" : "20x20" },
    { "filename" : "Icon-20-ipad@2x.png", "idiom" : "ipad", "scale" : "2x", "size" : "20x20" },
    { "filename" : "Icon-29-ipad.png", "idiom" : "ipad", "scale" : "1x", "size" : "29x29" },
    { "filename" : "Icon-29-ipad@2x.png", "idiom" : "ipad", "scale" : "2x", "size" : "29x29" },
    { "filename" : "Icon-40-ipad.png", "idiom" : "ipad", "scale" : "1x", "size" : "40x40" },
    { "filename" : "Icon-40-ipad@2x.png", "idiom" : "ipad", "scale" : "2x", "size" : "40x40" },
    { "filename" : "Icon-76-ipad.png", "idiom" : "ipad", "scale" : "1x", "size" : "76x76" },
    { "filename" : "Icon-76-ipad@2x.png", "idiom" : "ipad", "scale" : "2x", "size" : "76x76" },
    { "filename" : "Icon-83.5-ipad@2x.png", "idiom" : "ipad", "scale" : "2x", "size" : "83.5x83.5" },
    { "filename" : "Icon-1024.png", "idiom" : "ios-marketing", "scale" : "1x", "size" : "1024x1024" }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
JSON

echo "Generated AppIcon.appiconset from $source_icon."
