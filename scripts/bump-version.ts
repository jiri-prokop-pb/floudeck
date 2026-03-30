const version = process.argv[2];

if (!version) {
	console.error("Usage: bun run scripts/bump-version.ts <version>");
	console.error("Example: bun run scripts/bump-version.ts 0.2.0");
	process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
	console.error(`Invalid semver format: "${version}". Expected X.Y.Z`);
	process.exit(1);
}

// package.json
const pkgPath = "package.json";
const pkg = await Bun.file(pkgPath).json();
const oldVersion = pkg.version;
pkg.version = version;
await Bun.write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

// src-tauri/tauri.conf.json
const tauriPath = "src-tauri/tauri.conf.json";
const tauri = await Bun.file(tauriPath).json();
tauri.version = version;
await Bun.write(tauriPath, `${JSON.stringify(tauri, null, 2)}\n`);

// src-tauri/Cargo.toml
const cargoPath = "src-tauri/Cargo.toml";
const cargo = await Bun.file(cargoPath).text();
const updated = cargo.replace(/^version = ".*"$/m, `version = "${version}"`);
await Bun.write(cargoPath, updated);

console.log(`Version bumped: ${oldVersion} → ${version}`);
