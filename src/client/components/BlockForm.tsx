import { Play } from "@phosphor-icons/react";
import { useState } from "react";
import type { RunnerConfig } from "../../types.ts";
import { tryBlockApi } from "../lib/api.ts";
import { buildRunnerConfig } from "../lib/runnerConfig.ts";
import {
  type EnvEntry,
  parseEnvEntries,
  RunnerConfigFields,
} from "./RunnerConfigFields.tsx";
import { TryPanel, type TryState } from "./TryPanel.tsx";

type BlockFormData = {
  prompt: string;
  intervalValue: number;
  intervalUnit: string;
  runnerConfig?: RunnerConfig;
};

type BlockFormProps = {
  initialPrompt?: string;
  initialIntervalValue?: number;
  initialIntervalUnit?: string;
  initialRunnerConfig?: RunnerConfig;
  blockUuid?: string;
  submitLabel: string;
  onSubmit: (data: BlockFormData) => Promise<{ error?: string }>;
  onCancel?: () => void;
};

export function BlockForm({
  initialPrompt = "",
  initialIntervalValue = 15,
  initialIntervalUnit = "minutes",
  initialRunnerConfig,
  blockUuid,
  submitLabel,
  onSubmit,
  onCancel,
}: BlockFormProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [intervalValue, setIntervalValue] = useState(initialIntervalValue);
  const [intervalUnit, setIntervalUnit] = useState(initialIntervalUnit);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tryState, setTryState] = useState<TryState>({ status: "idle" });
  const [showAdvanced, setShowAdvanced] = useState(
    initialRunnerConfig !== undefined,
  );

  // Advanced fields
  const [model, setModel] = useState(initialRunnerConfig?.model ?? "");
  const [cwd, setCwd] = useState(initialRunnerConfig?.cwd ?? "");
  const [permissions, setPermissions] = useState(
    initialRunnerConfig?.permissions ?? "",
  );
  const [timeout, setTimeout_] = useState(
    initialRunnerConfig?.timeout?.toString() ?? "",
  );
  const [envEntries, setEnvEntries] = useState<EnvEntry[]>(
    parseEnvEntries(initialRunnerConfig?.env),
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!prompt.trim()) {
      setError("Prompt is required");
      return;
    }
    if (!Number.isInteger(intervalValue) || intervalValue <= 0) {
      setError("Interval must be a positive integer");
      return;
    }

    setLoading(true);
    const runnerConfig = buildRunnerConfig({
      model,
      permissions,
      timeout,
      envEntries,
      cwd,
    });
    const result = await onSubmit({
      prompt,
      intervalValue,
      intervalUnit,
      ...(runnerConfig ? { runnerConfig } : {}),
    });
    if (result.error) {
      setError(result.error);
    }
    setLoading(false);
  }

  async function handleTry() {
    if (!prompt.trim()) {
      setError("Prompt is required");
      return;
    }

    setError(null);
    setTryState({ status: "running" });

    const runnerConfig = buildRunnerConfig({
      model,
      permissions,
      timeout,
      envEntries,
      cwd,
    });

    const result = await tryBlockApi({
      prompt: prompt.trim(),
      ...(runnerConfig ? { runnerConfig } : {}),
    });

    if (result.ok) {
      setTryState({ status: "success", markdown: result.markdown });
    } else {
      setTryState({ status: "error", error: result.error });
    }
  }

  const isTrying = tryState.status === "running";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="What should this block do?"
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
        rows={3}
      />
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-600">Every</span>
        <input
          type="number"
          min={1}
          value={intervalValue}
          onChange={(e) => setIntervalValue(Number(e.target.value))}
          className="w-20 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm focus:border-zinc-400 focus:outline-none"
        />
        <select
          value={intervalUnit}
          onChange={(e) => setIntervalUnit(e.target.value)}
          className="h-9 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm focus:border-zinc-400 focus:outline-none"
        >
          <option value="minutes">minutes</option>
          <option value="hours">hours</option>
          <option value="days">days</option>
        </select>
        <div className="ml-auto flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleTry}
            disabled={loading || isTrying}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
          >
            <Play size={14} weight="bold" />
            {isTrying ? "Running..." : "Try"}
          </button>
          <button
            type="submit"
            disabled={loading || isTrying}
            className="rounded-lg bg-zinc-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {loading ? "Saving..." : submitLabel}
          </button>
        </div>
      </div>

      {/* Advanced toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-xs text-zinc-400 hover:text-zinc-600"
      >
        {showAdvanced ? "Hide" : "Show"} advanced settings
      </button>

      {showAdvanced && (
        <div className="space-y-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
          <RunnerConfigFields
            model={model}
            onModelChange={setModel}
            timeout={timeout}
            onTimeoutChange={setTimeout_}
            permissions={permissions}
            onPermissionsChange={setPermissions}
            envEntries={envEntries}
            onEnvChange={setEnvEntries}
          />

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-500">
              Working directory
            </span>
            <input
              type="text"
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
              placeholder={
                blockUuid
                  ? `~/.floudeck/blocks-workspace/${blockUuid}`
                  : "Will be auto-generated"
              }
              className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm placeholder:text-zinc-300 focus:border-zinc-400 focus:outline-none"
            />
          </label>
        </div>
      )}

      <TryPanel state={tryState} />

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
