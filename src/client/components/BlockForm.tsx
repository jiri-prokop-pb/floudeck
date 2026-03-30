import { useActionState, useEffect, useRef, useState } from "react";
import type { DebugEvent, RunnerConfig } from "../../types.ts";
import { tryBlockStreamApi } from "../lib/api.ts";
import { buildRunnerConfig } from "../lib/runnerConfig.ts";
import {
  type EnvEntry,
  parseEnvEntries,
  RunnerConfigFields,
} from "./RunnerConfigFields.tsx";
import { SplitTryButton, type TryMode } from "./SplitTryButton.tsx";
import { TryPanel, type TryState } from "./TryPanel.tsx";

type BlockFormData = {
  prompt: string;
  intervalValue: number;
  intervalUnit: string;
  runnerConfig?: RunnerConfig;
  tryResult?: string;
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
  const [tryState, setTryState] = useState<TryState>({ status: "idle" });
  const [tryMode, setTryMode] = useState<TryMode>("try");
  const [showAdvanced, setShowAdvanced] = useState(
    initialRunnerConfig !== undefined,
  );
  const abortRef = useRef<AbortController | null>(null);

  // Generate a stable UUID for new blocks so CWD is predictable
  const [generatedUuid] = useState(() => blockUuid ?? crypto.randomUUID());

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

  // Cleanup abort on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const [error, submitAction, isPending] = useActionState(
    async (_prev: string | null) => {
      if (!prompt.trim()) return "Prompt is required";
      if (!Number.isInteger(intervalValue) || intervalValue <= 0)
        return "Interval must be a positive integer";

      const runnerConfig = buildRunnerConfig({
        model,
        permissions,
        timeout,
        envEntries,
        cwd,
      });
      const tryMarkdown =
        tryState.status === "success" ? tryState.markdown : undefined;
      const result = await onSubmit({
        prompt,
        intervalValue,
        intervalUnit,
        ...(runnerConfig ? { runnerConfig } : {}),
        ...(tryMarkdown ? { tryResult: tryMarkdown } : {}),
      });
      return result.error ?? null;
    },
    null,
  );

  function handleTry() {
    if (!prompt.trim()) return;

    // Abort any previous try
    abortRef.current?.abort();

    const debugEvents: DebugEvent[] = [];
    setTryState({ status: "running", partialText: "", debugEvents });

    const runnerConfig = buildRunnerConfig({
      model,
      permissions,
      timeout,
      envEntries,
      cwd,
    });

    // Accumulate raw text and extract only the markdown portion for display
    let rawText = "";
    const BEGIN_MD = "===BEGIN_MARKDOWN===";
    const END_MD = "===END_MARKDOWN===";

    function extractVisibleText(raw: string): string {
      if (tryMode === "debug") return raw;
      const startIdx = raw.indexOf(BEGIN_MD);
      if (startIdx === -1) return "";
      const after = raw.slice(startIdx + BEGIN_MD.length);
      const endIdx = after.indexOf(END_MD);
      return endIdx === -1 ? after : after.slice(0, endIdx);
    }

    const controller = tryBlockStreamApi(
      {
        prompt: prompt.trim(),
        ...(runnerConfig ? { runnerConfig } : {}),
        debug: tryMode === "debug",
        blockUuid: generatedUuid,
      },
      {
        onText(text) {
          rawText += text;
          const visible = extractVisibleText(rawText);
          setTryState((prev) => {
            if (prev.status !== "running") return prev;
            return {
              ...prev,
              partialText: visible,
            };
          });
        },
        onDebug(event) {
          debugEvents.push(event);
          setTryState((prev) => {
            if (prev.status !== "running") return prev;
            return { ...prev, debugEvents: [...debugEvents] };
          });
        },
        onDone(markdown, reasoning) {
          setTryState({
            status: "success",
            markdown,
            reasoning,
            debugEvents: [...debugEvents],
          });
        },
        onError(errorMsg, permissionError) {
          setTryState({
            status: "error",
            error: errorMsg,
            permissionError,
            debugEvents: [...debugEvents],
            debugMode: tryMode === "debug",
          });
        },
      },
    );

    abortRef.current = controller;
  }

  useEffect(() => {
    if (tryState.status !== "idle") {
      requestAnimationFrame(() => {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  }, [tryState]);

  const isTrying = tryState.status === "running";

  return (
    <form action={submitAction} className="space-y-3">
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
              placeholder={`~/.floudeck/blocks-workspace/${generatedUuid}`}
              className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm placeholder:text-zinc-300 focus:border-zinc-400 focus:outline-none"
            />
          </label>
        </div>
      )}

      <TryPanel state={tryState} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            Cancel
          </button>
        )}
        <SplitTryButton
          mode={tryMode}
          onModeChange={setTryMode}
          onRun={handleTry}
          disabled={isPending}
          running={isTrying}
        />
        <button
          type="submit"
          disabled={isPending || isTrying}
          className="rounded-lg bg-zinc-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {isPending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
