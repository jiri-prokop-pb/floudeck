import { Suspense, use, useActionState, useState } from "react";
import {
  fetchDisplaySettings,
  fetchRunnerSettings,
  saveDisplaySettings,
  saveRunnerSettings,
} from "../lib/api.ts";
import { buildRunnerConfig } from "../lib/runnerConfig.ts";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { Modal } from "./Modal.tsx";
import {
  type EnvEntry,
  parseEnvEntries,
  RunnerConfigFields,
} from "./RunnerConfigFields.tsx";

type Tab = "runner" | "display";

type SettingsModalProps = {
  onClose: () => void;
  onDisplaySettingsChanged?: () => void;
};

export function SettingsModal({
  onClose,
  onDisplaySettingsChanged,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("runner");
  const [runnerPromise] = useState(() => fetchRunnerSettings());
  const [displayPromise] = useState(() => fetchDisplaySettings());

  return (
    <Modal title="Settings" onClose={onClose} wide>
      <div className="flex gap-6">
        <nav className="flex w-28 shrink-0 flex-col gap-1 border-r border-zinc-100 pr-4">
          <TabButton
            active={activeTab === "runner"}
            onClick={() => setActiveTab("runner")}
          >
            Runner
          </TabButton>
          <TabButton
            active={activeTab === "display"}
            onClick={() => setActiveTab("display")}
          >
            Display
          </TabButton>
        </nav>
        <div className="min-w-0 flex-1">
          {activeTab === "runner" && (
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
                <RunnerSectionLoader
                  promise={runnerPromise}
                  onClose={onClose}
                />
              </Suspense>
            </ErrorBoundary>
          )}
          {activeTab === "display" && (
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
                  onClose={onClose}
                  onSaved={onDisplaySettingsChanged}
                />
              </Suspense>
            </ErrorBoundary>
          )}
        </div>
      </div>
    </Modal>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-left text-sm ${
        active
          ? "bg-zinc-100 font-medium text-zinc-900"
          : "text-zinc-500 hover:text-zinc-700"
      }`}
    >
      {children}
    </button>
  );
}

function RunnerSectionLoader({
  promise,
  onClose,
}: {
  promise: Promise<import("../../types.ts").RunnerConfig | null>;
  onClose: () => void;
}) {
  const config = use(promise);
  return <RunnerSection initialConfig={config} onClose={onClose} />;
}

function RunnerSection({
  initialConfig,
  onClose,
}: {
  initialConfig: import("../../types.ts").RunnerConfig | null;
  onClose: () => void;
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
        onClose();
        return null;
      }
      return res.error;
    },
    null,
  );

  return (
    <form action={saveAction} className="space-y-4">
      <p className="text-xs text-zinc-400">
        These defaults apply to all blocks unless overridden per-block.
      </p>

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

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
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

function DisplaySectionLoader({
  promise,
  onClose,
  onSaved,
}: {
  promise: Promise<import("../../types.ts").DisplaySettings | null>;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const config = use(promise);
  return (
    <DisplaySection
      initialConfig={config}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function DisplaySection({
  initialConfig,
  onClose,
  onSaved,
}: {
  initialConfig: import("../../types.ts").DisplaySettings | null;
  onClose: () => void;
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

  const [error, saveAction, isSaving] = useActionState(
    async (_prev: string | null) => {
      const res = await saveDisplaySettings({
        dateFormat,
        timeFormat,
        compactMode,
      });
      if (res.ok) {
        onSaved?.();
        onClose();
        return null;
      }
      return res.error;
    },
    null,
  );

  return (
    <form action={saveAction} className="space-y-4">
      <p className="text-xs text-zinc-400">
        Configure how dates and times are displayed.
      </p>

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

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
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
