#!/usr/bin/env bash
set -euo pipefail

# Updates the Homebrew cask in jiri-prokop-pb/homebrew-tap after a release.
# Expected env vars: HOMEBREW_TAP_TOKEN, VERSION

if [[ -z "${HOMEBREW_TAP_TOKEN:-}" ]]; then
  echo "HOMEBREW_TAP_TOKEN is not set, skipping tap update"
  exit 0
fi

if [[ -z "${VERSION:-}" ]]; then
  echo "VERSION is not set"
  exit 1
fi

DMG_URL="https://github.com/jiri-prokop-pb/floudeck/releases/download/v${VERSION}/Floudeck_${VERSION}_aarch64.dmg"
WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

# Download DMG and compute SHA256
echo "Downloading DMG for v${VERSION}..."
curl -fSL -o "$WORK_DIR/Floudeck.dmg" "$DMG_URL"
SHA256=$(shasum -a 256 "$WORK_DIR/Floudeck.dmg" | awk '{print $1}')
echo "SHA256: $SHA256"

# Clone tap repo
echo "Cloning homebrew-tap..."
git clone --depth 1 "https://x-access-token:${HOMEBREW_TAP_TOKEN}@github.com/jiri-prokop-pb/homebrew-tap.git" "$WORK_DIR/tap"

CASK="$WORK_DIR/tap/Casks/floudeck.rb"

if [[ ! -f "$CASK" ]]; then
  echo "Cask file not found at $CASK"
  exit 1
fi

# Update version and sha256
sed -i '' "s/version \".*\"/version \"${VERSION}\"/" "$CASK"
sed -i '' "s/sha256 \".*\"/sha256 \"${SHA256}\"/" "$CASK"

# Commit and push
cd "$WORK_DIR/tap"
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add Casks/floudeck.rb
git commit -m "Update floudeck to v${VERSION}"
git push

echo "Homebrew tap updated to v${VERSION}"
