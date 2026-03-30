# Homebrew Tap Distribution

Research notes on distributing Floudeck via Homebrew.

## Separate repo required

Homebrew taps use a `homebrew-{name}` repo convention (e.g. `user/homebrew-floudeck`), enabling `brew tap user/floudeck` shorthand. No practical way around this — the formula/cask definitions must live in a dedicated repo.

## Cask formula structure

A Homebrew cask for a DMG-distributed app points to the GitHub release asset URL and includes version + SHA256:

```ruby
cask "floudeck" do
  version "0.2.0"
  sha256 "abc123..."
  url "https://github.com/user/floudeck/releases/download/v#{version}/Floudeck_#{version}_aarch64.dmg"
  name "Floudeck"
  homepage "https://github.com/user/floudeck"
  app "Floudeck.app"
end
```

## Signing deadline

Homebrew is phasing out unsigned casks by September 2026. The `--no-quarantine` workaround is being deprecated. Without code signing, cask installs will eventually fail or require manual security override.

## Implementation approach

The release workflow would update the cask formula in the tap repo via a GitHub Actions step:
1. Checkout the tap repo
2. Update version, SHA256, and URL in the cask file
3. Commit and push

This requires a PAT or deploy key for cross-repo push access.

## Prerequisites

- Apple Developer certificate ($99/yr) for code signing + notarization
- Without signing, macOS Gatekeeper blocks the app on first launch

## Recommendation

Defer Homebrew tap until code signing is implemented. Distribute DMGs as GitHub release assets for now.
