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
  onNavigateHome: () => void;
  onDisplaySettingsChanged?: () => void;
};

export function SettingsPage({
  onNavigateHome,
  onDisplaySettingsChanged,
}: SettingsPageProps) {
  const [runnerPromise] = useState(() => fetchRunnerSettings());
  const [displayPromise] = useState(() => fetchDisplaySettings());

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-6">
          <button
            type="button"
            onClick={onNavigateHome}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 mb-3 cursor-pointer"
          >
            <ArrowLeft size={14} weight="bold" />
            Back to feed
          </button>
          <h1 className="text-xl font-bold text-zinc-900">Settings</h1>
        </header>

        <div className="space-y-6">
          <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-zinc-900">Runner</h2>
              <p className="text-xs text-zinc-400">
                Defaults for all blocks unless overridden per-block.
              </p>
            </div>
            <div className="px-5 py-4">
              <ErrorBoundary
                fallback={
                  <p className="text-sm text-red-600">
                    Failed to load runner settings
                  </p>
                }
              >
                <Suspense
                  fallback={<p className="text-sm text-zinc-400">Loading...</p>}
                >
                  <RunnerSectionLoader promise={runnerPromise} />
                </Suspense>
              </ErrorBoundary>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-zinc-900">Display</h2>
              <p className="text-xs text-zinc-400">
                Configure how dates and times are displayed.
              </p>
            </div>
            <div className="px-5 py-4">
              <ErrorBoundary
                fallback={
                  <p className="text-sm text-red-600">
                    Failed to load display settings
                  </p>
                }
              >
                <Suspense
                  fallback={<p className="text-sm text-zinc-400">Loading...</p>}
                >
                  <DisplaySectionLoader
                    promise={displayPromise}
                    onSaved={onDisplaySettingsChanged}
                  />
                </Suspense>
              </ErrorBoundary>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function RunnerSectionLoader({
  promise,
}: {
  promise: Promise<RunnerConfig | null>;
}) {
  const config = use(promise);
  return <RunnerSection initialConfig={config} />;
}

function RunnerSection({
  initialConfig,
}: {
  initialConfig: RunnerConfig | null;
}) {
  const [model, setModel] = useState(initialConfig?.model ?? "");
  const [permissions, setPermissions] = useState(
    initialConfig?.permissions ?? "",
  );
  const [timeout, setTimeout_] = useState(
    initialConfig?.timeout?.toString() ?? "",
  );
  const [envEntries, setEnvEntries] = useState<EnvEntry[]>(
    parseEnvEntries(initialConfig?.env),
  );
  const [saved, setSaved] = useState(false);

  const [error, saveAction, isSaving] = useActionState(
    async (_prev: string | null) => {
      const config = buildRunnerConfig({
        model,
        permissions,
        timeout,
        envEntries,
      });
      const res = await saveRunnerSettings(config ?? null);
      if (res.ok) {
        setSaved(true);
        globalThis.setTimeout(() => setSaved(false), 2000);
        return null;
      }
      return res.error;
    },
    null,
  );

  return (
    <form action={saveAction} className="space-y-4">
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        {saved && (
          <span className="text-sm text-green-600">Settings saved</span>
        )}
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

function DisplaySectionLoader({
  promise,
  onSaved,
}: {
  promise: Promise<DisplaySettings | null>;
  onSaved?: () => void;
}) {
  const config = use(promise);
  return <DisplaySection initialConfig={config} onSaved={onSaved} />;
}

function DisplaySection({
  initialConfig,
  onSaved,
}: {
  initialConfig: DisplaySettings | null;
  onSaved?: () => void;
}) {
  const [dateFormat, setDateFormat] = useState(
    initialConfig?.dateFormat ?? "D. M.",
  );
  const [timeFormat, setTimeFormat] = useState(
    initialConfig?.timeFormat ?? "24h",
  );
  const [compactMode, setCompactMode] = useState(
    initialConfig?.compactMode ?? false,
  );
  const [saved, setSaved] = useState(false);

  const [error, saveAction, isSaving] = useActionState(
    async (_prev: string | null) => {
      const res = await saveDisplaySettings({
        dateFormat,
        timeFormat,
        compactMode,
      });
      if (res.ok) {
        onSaved?.();
        setSaved(true);
        globalThis.setTimeout(() => setSaved(false), 2000);
        return null;
      }
      return res.error;
    },
    null,
  );

  return (
    <form action={saveAction} className="space-y-4">
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        {saved && (
          <span className="text-sm text-green-600">Settings saved</span>
        )}
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
