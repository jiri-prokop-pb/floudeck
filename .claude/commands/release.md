Create a release PR for Floudeck.

1. Read the current version from `package.json`
2. Find the latest release tag and analyze changes since then: `git log v{current}..HEAD --oneline`. Based on the changes, suggest the appropriate version bump:
   - **patch** for bug fixes only
   - **minor** for new features
   - **major** for breaking changes
3. Present the suggestion with reasoning and ask the user for the new version
4. Run `bun run bump {version}`
5. Create branch `release/v{version}`
6. Commit only the 3 version files (`package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`) with message `Release v{version}`
7. Push the branch and open a PR titled `Release v{version}` targeting `main`
