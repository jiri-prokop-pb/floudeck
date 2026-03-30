# Homebrew Tap Distribution

Floudeck is distributed via [jiri-prokop-pb/homebrew-tap](https://github.com/jiri-prokop-pb/homebrew-tap).

## Install

```bash
brew install --cask jiri-prokop-pb/tap/floudeck
```

Quarantine is removed automatically by the cask's `postflight` hook (the app is not yet code-signed).

## How it works

The release workflow (`release.yml`) updates the tap automatically on every GitHub release:
1. Downloads the DMG artifact
2. Computes SHA256
3. Updates version, SHA256, and URL in the cask file
4. Commits and pushes to the tap repo

Requires `HOMEBREW_TAP_TOKEN` repository secret (PAT with `repo` scope for cross-repo push).

## Code signing

Homebrew is phasing out unsigned casks by September 2026. Without code signing, cask installs will eventually require manual security overrides. Needs Apple Developer Program ($99/year) — configure in `tauri.conf.json` `bundle.macOS.signing`.
