import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const DEFAULT_DATA_DIR = join(homedir(), ".floudeck");

let dataDir: string | null = null;

export function setDataDir(dir: string): void {
  dataDir = dir;
}

export function getDataDir(): string {
  return dataDir ?? DEFAULT_DATA_DIR;
}

export function getDbPath(): string {
  return join(getDataDir(), "floudeck.sqlite");
}

export function getWorkspaceRoot(): string {
  return join(getDataDir(), "blocks-workspace");
}

export function ensureDataDir(): void {
  mkdirSync(getDataDir(), { recursive: true });
}

/**
 * Resolve the absolute path to the `claude` CLI binary.
 * When launched from Finder, $PATH is minimal — check common locations.
 */
export function resolveClaudePath(): string {
  // 1. Check if `claude` is already on PATH via `which`
  try {
    const result = Bun.spawnSync(["which", "claude"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    if (result.exitCode === 0) {
      const path = result.stdout.toString().trim();
      if (path) return path;
    }
  } catch {
    // which not available or failed
  }

  // 2. Check common locations
  const home = homedir();
  const candidates = [
    join(home, ".claude", "local", "claude"),
    "/usr/local/bin/claude",
    join(home, ".local", "bin", "claude"),
    join(home, ".nvm", "current", "bin", "claude"), // nvm users
    "/opt/homebrew/bin/claude",
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  // 3. Fallback — hope it's on PATH at runtime
  return "claude";
}

/**
 * Resolve the path to pre-built client assets.
 * In compiled mode: look next to the binary.
 * In dev mode: not used (HTML imports handle it).
 */
export function getClientAssetsDir(): string {
  // import.meta.dir points to the directory containing the running script/binary
  return join(dirname(process.execPath), "client");
}
