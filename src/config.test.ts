import { describe, expect, test } from "bun:test";
import {
  buildCliArgs,
  buildStreamingCliArgs,
  formatCliCommand,
  resolveRunnerConfig,
} from "./config.ts";
import { ACTION_SYSTEM_PROMPT, SYSTEM_PROMPT } from "./prompts.ts";
import type { ResolvedRunnerConfig, RunnerConfig } from "./types.ts";
import { ENV_INHERIT_SENTINEL } from "./types.ts";

describe("resolveRunnerConfig", () => {
  const uuid = "test-uuid-1234";

  test("returns hardcoded defaults when no global or block config", () => {
    const result = resolveRunnerConfig(null, null, uuid);
    expect(result.model).toBe("sonnet");
    expect(result.permissions).toBe("default");
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

  test("block cwd with ~ expands to HOME", () => {
    const block: RunnerConfig = { cwd: "~/my-project" };
    const result = resolveRunnerConfig(null, block, uuid);
    expect(result.cwd).toBe(`${Bun.env.HOME}/my-project`);
    expect(result.cwd).not.toContain("~");
  });

  test("block cwd with bare ~ expands to HOME", () => {
    const block: RunnerConfig = { cwd: "~" };
    const result = resolveRunnerConfig(null, block, uuid);
    expect(result.cwd).toBe(Bun.env.HOME);
  });

  test("default cwd uses HOME env var, not node:os homedir", () => {
    const result = resolveRunnerConfig(null, null, uuid);
    const home = Bun.env.HOME ?? "/tmp";
    expect(result.cwd).toBe(`${home}/.floudeck/blocks-workspace/${uuid}`);
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
    permissions: "default",
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

  test("prompt is last argument after -- separator", () => {
    const args = buildCliArgs(baseConfig, "my prompt");
    expect(args[args.length - 1]).toBe("my prompt");
    expect(args[args.length - 2]).toBe("--");
  });

  test("prompt starting with dashes is safe after -- separator", () => {
    const prompt = "--- Block Context ---\n# Title\nContent";
    const args = buildCliArgs(baseConfig, prompt);
    const dashDashIdx = args.indexOf("--");
    expect(dashDashIdx).toBeGreaterThan(-1);
    expect(args[dashDashIdx + 1]).toBe(prompt);
  });
});

describe("buildCliArgs with custom system prompt", () => {
  const baseConfig: ResolvedRunnerConfig = {
    cwd: "/tmp/test",
    model: "sonnet",
    permissions: "default",
    env: {},
    timeout: 60,
  };

  test("uses provided system prompt instead of default", () => {
    const args = buildCliArgs(baseConfig, "test", ACTION_SYSTEM_PROMPT);
    expect(args).toContain(ACTION_SYSTEM_PROMPT);
    expect(args).not.toContain(SYSTEM_PROMPT);
  });

  test("prompt starting with dashes is safe after -- separator", () => {
    const prompt = "--- Block Context ---\n# Joke of the Day\nContent";
    const args = buildCliArgs(baseConfig, prompt, ACTION_SYSTEM_PROMPT);
    const dashDashIdx = args.indexOf("--");
    expect(dashDashIdx).toBeGreaterThan(-1);
    expect(args[dashDashIdx + 1]).toBe(prompt);
    expect(args[args.length - 1]).toBe(prompt);
  });
});

describe("buildStreamingCliArgs", () => {
  const baseConfig: ResolvedRunnerConfig = {
    cwd: "/tmp/test",
    model: "sonnet",
    permissions: "default",
    env: {},
    timeout: 60,
  };

  test("includes streaming flags", () => {
    const args = buildStreamingCliArgs(baseConfig, "test");
    expect(args).toContain("--output-format");
    expect(args).toContain("stream-json");
    expect(args).toContain("--verbose");
    expect(args).toContain("--include-partial-messages");
  });

  test("includes --print flag", () => {
    const args = buildStreamingCliArgs(baseConfig, "test");
    expect(args).toContain("--print");
  });

  test("includes model and system prompt", () => {
    const args = buildStreamingCliArgs(baseConfig, "test");
    expect(args).toContain("--model");
    expect(args).toContain("sonnet");
    expect(args).toContain("--append-system-prompt");
  });

  test("prompt is last argument after --", () => {
    const args = buildStreamingCliArgs(baseConfig, "my prompt");
    expect(args[args.length - 1]).toBe("my prompt");
    expect(args[args.length - 2]).toBe("--");
  });
});

describe("formatCliCommand", () => {
  const baseConfig: ResolvedRunnerConfig = {
    cwd: "/tmp/test",
    model: "sonnet",
    permissions: "default",
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
