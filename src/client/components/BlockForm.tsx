import { Play } from "@phosphor-icons/react";
import { useActionState, useEffect, useState } from "react";
import type { ActionDefinition, BlockType, RunnerConfig } from "../../types.ts";
import type { ActionBlockFormInput, BlockFormInput } from "../lib/api.ts";
import { tryBlockApi } from "../lib/api.ts";
import { buildRunnerConfig } from "../lib/runnerConfig.ts";
import { ActionListEditor } from "./ActionListEditor.tsx";
import {
  type EnvEntry,
  parseEnvEntries,
  RunnerConfigFields,
} from "./RunnerConfigFields.tsx";
import { TryPanel, type TryState } from "./TryPanel.tsx";

type BlockFormData = BlockFormInput | ActionBlockFormInput;

type BlockFormProps = {
  initialBlockType?: BlockType;
  initialPrompt?: string;
  initialIntervalValue?: number;
  initialIntervalUnit?: string;
  initialRunnerConfig?: RunnerConfig;
  initialTitle?: string;
  initialActions?: ActionDefinition[];
  blockUuid?: string;
  submitLabel: string;
  onSubmit: (data: BlockFormData) => Promise<{ error?: string }>;
  onCancel?: () => void;
};

export function BlockForm({
  initialBlockType = "scheduled",
  initialPrompt = "",
  initialIntervalValue = 15,
  initialIntervalUnit = "minutes",
  initialRunnerConfig,
  initialTitle = "",
  initialActions,
  blockUuid,
  submitLabel,
  onSubmit,
  onCancel,
}: BlockFormProps) {
  const [blockType, setBlockType] = useState<BlockType>(initialBlockType);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [intervalValue, setIntervalValue] = useState(initialIntervalValue);
  const [intervalUnit, setIntervalUnit] = useState(initialIntervalUnit);
  const [title, setTitle] = useState(initialTitle);
  const [actions, setActions] = useState<ActionDefinition[]>(
    initialActions ?? [{ name: "", label: "", prompt: "" }],
  );
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

  const [error, submitAction, isPending] = useActionState(
    async (_prev: string | null) => {
      const runnerConfig = buildRunnerConfig({
        model,
        permissions,
        timeout,
        envEntries,
        cwd,
      });

      if (blockType === "action") {
        if (actions.some((a) => !a.label.trim() || !a.prompt.trim()))
          return "All actions must have a label and prompt";
        const result = await onSubmit({
          blockType: "action",
          ...(title.trim() ? { title: title.trim() } : {}),
          actions,
          ...(runnerConfig ? { runnerConfig } : {}),
        });
        return result.error ?? null;
      }

      if (!prompt.trim()) return "Prompt is required";
      if (!Number.isInteger(intervalValue) || intervalValue <= 0)
        return "Interval must be a positive integer";

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

  async function handleTry() {
    if (!prompt.trim()) {
      return;
    }

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

  const isEditing = initialBlockType !== "scheduled" || blockUuid;
  const showTypeToggle = !isEditing;

  return (
    <form action={submitAction} className="space-y-3">
      {/* Block type toggle */}
      {showTypeToggle && (
        <div className="flex rounded-lg border border-zinc-200 p-0.5 w-fit">
          <button
            type="button"
            onClick={() => setBlockType("scheduled")}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              blockType === "scheduled"
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            Scheduled
          </button>
          <button
            type="button"
            onClick={() => setBlockType("action")}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              blockType === "action"
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            Action block
          </button>
        </div>
      )}

      {blockType === "action" ? (
        <>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-500">
              Title (optional)
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My action block"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
            />
          </label>
          <div>
            <span className="mb-2 block text-xs font-medium text-zinc-500">
              Actions
            </span>
            <ActionListEditor actions={actions} onChange={setActions} />
          </div>
        </>
      ) : (
        <>
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
        </>
      )}

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
              className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm placeholder:text-zinc-300 focus:border-zinc-400 focus:outline-none"
            />
          </label>
        </div>
      )}

      {blockType === "scheduled" && <TryPanel state={tryState} />}

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
        {blockType === "scheduled" && (
          <button
            type="button"
            onClick={handleTry}
            disabled={isPending || isTrying}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
          >
            <Play size={14} weight="bold" />
            {isTrying ? "Running..." : "Try"}
          </button>
        )}
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
