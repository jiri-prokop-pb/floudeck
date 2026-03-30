import { ArrowLeft } from "@phosphor-icons/react";
import { Suspense, use, useActionState, useState } from "react";
import type { DisplaySettings, RunnerConfig } from "../../types.ts";
import {
  fetchDisplaySettings,
  fetchRunnerSettings,
  saveDisplaySettings,
  saveRunnerSettings,
} from "../lib/api.ts";
import { buildRunnerConfig } from "../lib/runnerConfig.ts";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import {
  type EnvEntry,
  parseEnvEntries,
  RunnerConfigFields,
} from "./RunnerConfigFields.tsx";

type SettingsPageProps = {
  compact?: boolean;
  onNavigateHome: () => void;
  onDisplaySettingsChanged?: () => void;
};

export function SettingsPage({
  compact,
  onNavigateHome,
  onDisplaySettingsChanged,
}: SettingsPageProps) {
  const [runnerPromise] = useState(() => fetchRunnerSettings());
  const [displayPromise] = useState(() => fetchDisplaySettings());

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className={`mx-auto max-w-3xl px-4 ${compact ? "py-4" : "py-10"}`}>
        <header className={compact ? "mb-3" : "mb-6"}>
          <button
            type="button"
            onClick={onNavigateHome}
            className={`flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 cursor-pointer ${compact ? "mb-1.5" : "mb-3"}`}
          >
            <ArrowLeft size={14} weight="bold" />
            Back to feed
          </button>
          <h1
            className={`font-bold text-zinc-900 ${compact ? "text-base" : "text-xl"}`}
          >
            Settings
          </h1>
        </header>

        <ErrorBoundary
          fallback={
            <p className="text-sm text-red-600">Failed to load settings</p>
          }
        >
          <Suspense
            fallback={<p className="text-sm text-zinc-400">Loading...</p>}
          >
            <SettingsFormLoader
              runnerPromise={runnerPromise}
              displayPromise={displayPromise}
              onNavigateHome={onNavigateHome}
              onDisplaySettingsChanged={onDisplaySettingsChanged}
            />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}

function SettingsFormLoader({
  runnerPromise,
  displayPromise,
  onNavigateHome,
  onDisplaySettingsChanged,
}: {
  runnerPromise: Promise<RunnerConfig | null>;
  displayPromise: Promise<DisplaySettings | null>;
  onNavigateHome: () => void;
  onDisplaySettingsChanged?: () => void;
}) {
  const runnerConfig = use(runnerPromise);
  const displayConfig = use(displayPromise);
  return (
    <SettingsForm
      initialRunnerConfig={runnerConfig}
      initialDisplayConfig={displayConfig}
      onNavigateHome={onNavigateHome}
      onDisplaySettingsChanged={onDisplaySettingsChanged}
    />
  );
}

function SettingsForm({
  initialRunnerConfig,
  initialDisplayConfig,
  onNavigateHome,
  onDisplaySettingsChanged,
}: {
  initialRunnerConfig: RunnerConfig | null;
  initialDisplayConfig: DisplaySettings | null;
  onNavigateHome: () => void;
  onDisplaySettingsChanged?: () => void;
}) {
  // Runner fields
  const [model, setModel] = useState(initialRunnerConfig?.model ?? "");
  const [permissions, setPermissions] = useState(
    initialRunnerConfig?.permissions ?? "",
  );
  const [timeout, setTimeout_] = useState(
    initialRunnerConfig?.timeout?.toString() ?? "",
  );
  const [envEntries, setEnvEntries] = useState<EnvEntry[]>(
    parseEnvEntries(initialRunnerConfig?.env),
  );

  // Display fields
  const [dateFormat, setDateFormat] = useState(
    initialDisplayConfig?.dateFormat ?? "D. M.",
  );
  const [timeFormat, setTimeFormat] = useState(
    initialDisplayConfig?.timeFormat ?? "24h",
  );
  const [compactMode, setCompactMode] = useState(
    initialDisplayConfig?.compactMode ?? false,
  );

  const [error, saveAction, isSaving] = useActionState(
    async (_prev: string | null) => {
      const config = buildRunnerConfig({
        model,
        permissions,
        timeout,
        envEntries,
      });
      const [runnerRes, displayRes] = await Promise.all([
        saveRunnerSettings(config ?? null),
        saveDisplaySettings({ dateFormat, timeFormat, compactMode }),
      ]);
      if (!runnerRes.ok) return runnerRes.error;
      if (!displayRes.ok) return displayRes.error;
      onDisplaySettingsChanged?.();
      onNavigateHome();
      return null;
    },
    null,
  );

  return (
    <form action={saveAction} className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Runner</h2>
          <p className="text-xs text-zinc-400">
            Defaults for all blocks unless overridden per-block.
          </p>
        </div>
        <div className="px-5 py-4">
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
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Display</h2>
          <p className="text-xs text-zinc-400">
            Configure how dates and times are displayed.
          </p>
        </div>
        <div className="px-5 py-4 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">
              Date format
            </span>
            <select
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              className="h-9 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-800"
            >
              <option value="D. M.">Wed 18. 3.</option>
              <option value="MM-DD">Wed 03-18</option>
              <option value="DD/MM">Wed 18/03</option>
              <option value="MM/DD">Wed 03/18</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">
              Time format
            </span>
            <select
              value={timeFormat}
              onChange={(e) => setTimeFormat(e.target.value)}
              className="h-9 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-800"
            >
              <option value="24h">24-hour</option>
              <option value="12h">12-hour</option>
            </select>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={compactMode}
              onChange={(e) => setCompactMode(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-zinc-800 focus:ring-zinc-500"
            />
            <span className="text-sm text-zinc-700">Compact mode</span>
            <span className="text-xs text-zinc-400">
              Reduce spacing for more content
            </span>
          </label>
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onNavigateHome}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-zinc-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
