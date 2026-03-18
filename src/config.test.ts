import { describe, expect, test } from "bun:test";
import {
  buildCliArgs,
  formatCliCommand,
  resolveRunnerConfig,
} from "./config.ts";
import { SYSTEM_PROMPT } from "./prompts.ts";
import type { ResolvedRunnerConfig, RunnerConfig } from "./types.ts";
import { ENV_INHERIT_SENTINEL } from "./types.ts";

describe("resolveRunnerConfig", () => {
  const uuid = "test-uuid-1234";

  test("returns hardcoded defaults when no global or block config", () => {
    const result = resolveRunnerConfig(null, null, uuid);
    expect(result.model).toBe("sonnet");
    expect(result.permissions).toBe("sandbox");
    expect(result.timeout).toBe(60);
    expect(result.env).toEqual({});
    expect(result.cwd).toContain(uuid);
    expect(result.cwd).toContain(".floudeck/blocks-workspace");
  });

  test("global config overrides hardcoded defaults", () => {
    const global: RunnerConfig = {
      model: "opus",
      permissions: "dangerouslySkipPermissions",
      timeout: 120,
    };
    const result = resolveRunnerConfig(global, null, uuid);
    expect(result.model).toBe("opus");
    expect(result.permissions).toBe("dangerouslySkipPermissions");
    expect(result.timeout).toBe(120);
  });

  test("block config overrides global config", () => {
    const global: RunnerConfig = { model: "opus", timeout: 120 };
    const block: RunnerConfig = { model: "haiku", timeout: 30 };
    const result = resolveRunnerConfig(global, block, uuid);
    expect(result.model).toBe("haiku");
    expect(result.timeout).toBe(30);
  });

  test("cwd is not affected by global config", () => {
    const global: RunnerConfig = { cwd: "/global/path" };
    const result = resolveRunnerConfig(global, null, uuid);
    // Global cwd is ignored — should use default
    expect(result.cwd).toContain(uuid);
    expect(result.cwd).not.toBe("/global/path");
  });

  test("block cwd overrides default", () => {
    const block: RunnerConfig = { cwd: "/my/project" };
    const result = resolveRunnerConfig(null, block, uuid);
    expect(result.cwd).toBe("/my/project");
  });

  test("env merge: global + block, block wins", () => {
    const global: RunnerConfig = {
      env: { API_KEY: "global-key", SHARED: "from-global" },
    };
    const block: RunnerConfig = { env: { SHARED: "from-block", EXTRA: "val" } };
    const result = resolveRunnerConfig(global, block, uuid);
    expect(result.env).toEqual({
      API_KEY: "global-key",
      SHARED: "from-block",
      EXTRA: "val",
    });
  });

  test("env inherit sentinel resolves from Bun.env", () => {
    // Set a test env var
    const origValue = Bun.env.FLOUDECK_TEST_VAR;
    process.env.FLOUDECK_TEST_VAR = "inherited-value";

    const block: RunnerConfig = {
      env: { FLOUDECK_TEST_VAR: ENV_INHERIT_SENTINEL },
    };
    const result = resolveRunnerConfig(null, block, uuid);
    expect(result.env.FLOUDECK_TEST_VAR).toBe("inherited-value");

    // Cleanup
    if (origValue === undefined) {
      delete process.env.FLOUDECK_TEST_VAR;
    } else {
      process.env.FLOUDECK_TEST_VAR = origValue;
    }
  });

  test("env inherit sentinel omits missing keys silently", () => {
    const block: RunnerConfig = {
      env: { DEFINITELY_NOT_SET_12345: ENV_INHERIT_SENTINEL },
    };
    const result = resolveRunnerConfig(null, block, uuid);
    expect(result.env.DEFINITELY_NOT_SET_12345).toBeUndefined();
  });
});

describe("buildCliArgs", () => {
  const baseConfig: ResolvedRunnerConfig = {
    cwd: "/tmp/test",
    model: "sonnet",
    permissions: "sandbox",
    env: {},
    timeout: 60,
  };

  test("sandbox mode does not push any permission flag", () => {
    const args = buildCliArgs(baseConfig, "test prompt");
    expect(args).not.toContain("--sandbox");
    expect(args).not.toContain("--dangerously-skip-permissions");
  });

  test("dangerouslySkipPermissions mode uses correct flag", () => {
    const config = {
      ...baseConfig,
      permissions: "dangerouslySkipPermissions" as const,
    };
    const args = buildCliArgs(config, "test prompt");
    expect(args).toContain("--dangerously-skip-permissions");
    expect(args).not.toContain("--sandbox");
  });

  test("includes model flag", () => {
    const args = buildCliArgs(baseConfig, "test prompt");
    const modelIdx = args.indexOf("--model");
    expect(modelIdx).toBeGreaterThan(-1);
    expect(args[modelIdx + 1]).toBe("sonnet");
  });

  test("includes system prompt", () => {
    const args = buildCliArgs(baseConfig, "test prompt");
    expect(args).toContain("--append-system-prompt");
    expect(args).toContain(SYSTEM_PROMPT);
  });

  test("prompt is last argument", () => {
    const args = buildCliArgs(baseConfig, "my prompt");
    expect(args[args.length - 1]).toBe("my prompt");
  });
});

describe("formatCliCommand", () => {
  const baseConfig: ResolvedRunnerConfig = {
    cwd: "/tmp/test",
    model: "sonnet",
    permissions: "sandbox",
    env: {},
    timeout: 60,
  };

  test("returns a string containing claude", () => {
    const cmd = formatCliCommand(baseConfig, "test");
    expect(cmd).toContain("claude");
    expect(cmd).toContain("--model");
  });

  test("truncates long prompts", () => {
    const longPrompt = "a".repeat(200);
    const cmd = formatCliCommand(baseConfig, longPrompt);
    expect(cmd).toContain("...");
    // The prompt part should be truncated, not the full 200 chars
    expect(cmd).not.toContain("a".repeat(200));
  });
});
