/**
 * Build script for Floudeck.
 *
 * 1. Compile server binary → src-tauri/binaries/
 * 2. Bundle frontend → dist/client/
 * 3. Assemble dist/ (binary + client assets)
 *
 * Usage:
 *   bun run scripts/build.ts [--target-triple <triple>]
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = join(import.meta.dir, "..");

function getTargetTriple(): string {
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === "--target-triple" && process.argv[i + 1]) {
      return process.argv[i + 1];
    }
  }
  const arch = process.arch === "arm64" ? "aarch64" : "x86_64";
  return `${arch}-apple-darwin`;
}

async function buildServer(triple: string): Promise<string> {
  const tauriDir = join(ROOT, "src-tauri", "binaries");
  const binaryName = `floudeck-server-${triple}`;
  const binaryPath = join(tauriDir, binaryName);

  console.log(`→ Compiling server binary (${triple})...`);
  mkdirSync(dirname(binaryPath), { recursive: true });

  const proc = Bun.spawn(
    [
      "bun",
      "build",
      "--compile",
      join(ROOT, "src", "server.ts"),
      "--outfile",
      binaryPath,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    console.error("Server build failed");
    process.exit(1);
  }

  console.log(`  → ${binaryPath.replace(ROOT, ".")}`);
  return binaryPath;
}

async function buildClient(): Promise<string> {
  const outdir = join(ROOT, "dist", "client");
  console.log("→ Building client assets...");

  if (existsSync(outdir)) {
    rmSync(outdir, { recursive: true });
  }
  mkdirSync(outdir, { recursive: true });

  const result = await Bun.build({
    entrypoints: [
      join(ROOT, "src", "client", "app.tsx"),
      join(ROOT, "src", "client", "main.css"),
    ],
    outdir,
    minify: true,
    splitting: false,
    target: "browser",
    plugins: [require("bun-plugin-tailwind").default],
  });

  if (!result.success) {
    console.error("Client build failed:");
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  const outputs = result.outputs.map((o) => o.path);
  console.log(
    `  Built: ${outputs.map((o) => o.replace(ROOT, ".")).join(", ")}`,
  );

  // Generate index.html referencing built assets
  const jsFile = outputs.find((o) => o.endsWith(".js"));
  const cssFile = outputs.find((o) => o.endsWith(".css"));
  const jsName = jsFile ? jsFile.split("/").pop() : "app.js";
  const cssName = cssFile ? cssFile.split("/").pop() : "";

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Floudeck</title>
    ${cssName ? `<link rel="stylesheet" href="/${cssName}" />` : ""}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/${jsName}"></script>
  </body>
</html>`;

  await Bun.write(join(outdir, "index.html"), html);

  // Copy static assets
  const assetsDir = join(ROOT, "src", "client", "assets");
  if (existsSync(assetsDir)) {
    cpSync(assetsDir, outdir, { recursive: true });
  }

  console.log("  Generated index.html");
  return outdir;
}

function assembleDist(binaryPath: string): void {
  const distDir = join(ROOT, "dist");
  const distBinary = join(distDir, "floudeck-server");
  const distClient = join(distDir, "client");

  mkdirSync(distDir, { recursive: true });

  // Copy binary
  cpSync(binaryPath, distBinary);

  // Client assets are already in dist/client from buildClient
  console.log(`\n  Standalone binary: ${distBinary.replace(ROOT, ".")}`);
  console.log(`  Client assets:    ${distClient.replace(ROOT, ".")}`);
}

const triple = getTargetTriple();
const binaryPath = await buildServer(triple);
await buildClient();
assembleDist(binaryPath);
console.log("\n✓ Build complete");
