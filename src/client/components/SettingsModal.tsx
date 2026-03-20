import { useEffect, useState } from "react";
import {
  fetchDisplaySettings,
  fetchRunnerSettings,
  saveDisplaySettings,
  saveRunnerSettings,
} from "../lib/api.ts";
import { buildRunnerConfig } from "../lib/runnerConfig.ts";
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
          {activeTab === "runner" && <RunnerSection onClose={onClose} />}
          {activeTab === "display" && (
            <DisplaySection
              onClose={onClose}
              onSaved={onDisplaySettingsChanged}
            />
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

function RunnerSection({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [model, setModel] = useState("");
  const [permissions, setPermissions] = useState("");
  const [timeout, setTimeout_] = useState("");
  const [envEntries, setEnvEntries] = useState<EnvEntry[]>([]);

  useEffect(() => {
    fetchRunnerSettings().then((config) => {
      if (config) {
        setModel(config.model ?? "");
        setPermissions(config.permissions ?? "");
        setTimeout_(config.timeout?.toString() ?? "");
        setEnvEntries(parseEnvEntries(config.env));
      }
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    setError(null);
    setSaving(true);

    const config = buildRunnerConfig({
      model,
      permissions,
      timeout,
      envEntries,
    });
    const res = await saveRunnerSettings(config ?? null);
    setSaving(false);
    if (res.ok) {
      onClose();
    } else {
      setError(res.error);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-400">Loading...</p>;
  }

  return (
    <div className="space-y-4">
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
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-zinc-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function DisplaySection({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dateFormat, setDateFormat] = useState("D. M.");
  const [timeFormat, setTimeFormat] = useState("24h");

  useEffect(() => {
    fetchDisplaySettings().then((config) => {
      if (config) {
        setDateFormat(config.dateFormat ?? "D. M.");
        setTimeFormat(config.timeFormat ?? "24h");
      }
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    setError(null);
    setSaving(true);

    const res = await saveDisplaySettings({ dateFormat, timeFormat });
    setSaving(false);
    if (res.ok) {
      onSaved?.();
      onClose();
    } else {
      setError(res.error);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-400">Loading...</p>;
  }

  return (
    <div className="space-y-4">
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
          className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-800"
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
          className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-800"
        >
          <option value="24h">24-hour</option>
          <option value="12h">12-hour</option>
        </select>
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
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-zinc-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
