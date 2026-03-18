import { useEffect, useState } from "react";
import type { RunnerConfig } from "../../types.ts";
import { ENV_INHERIT_SENTINEL } from "../../types.ts";
import { fetchRunnerSettings, saveRunnerSettings } from "../lib/api.ts";
import { Modal } from "./Modal.tsx";

type EnvEntry = { id: number; key: string; value: string; inherit: boolean };

let nextEnvId = 1;

function parseEnvEntries(env?: Record<string, string>): EnvEntry[] {
  if (!env || Object.keys(env).length === 0) return [];
  return Object.entries(env).map(([key, value]) => ({
    id: nextEnvId++,
    key,
    value: value === ENV_INHERIT_SENTINEL ? "" : value,
    inherit: value === ENV_INHERIT_SENTINEL,
  }));
}

function entriesToEnv(entries: EnvEntry[]): Record<string, string> | undefined {
  const filtered = entries.filter((e) => e.key.trim());
  if (filtered.length === 0) return undefined;
  const env: Record<string, string> = {};
  for (const entry of filtered) {
    env[entry.key.trim()] = entry.inherit ? ENV_INHERIT_SENTINEL : entry.value;
  }
  return env;
}

type SettingsModalProps = {
  onClose: () => void;
};

export function SettingsModal({ onClose }: SettingsModalProps) {
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

    const config: RunnerConfig = {};
    let hasKeys = false;

    if (model.trim()) {
      config.model = model.trim();
      hasKeys = true;
    }
    if (
      permissions === "sandbox" ||
      permissions === "dangerouslySkipPermissions"
    ) {
      config.permissions = permissions;
      hasKeys = true;
    }
    const timeoutNum = Number(timeout);
    if (timeout.trim() && timeoutNum > 0) {
      config.timeout = timeoutNum;
      hasKeys = true;
    }
    const env = entriesToEnv(envEntries);
    if (env) {
      config.env = env;
      hasKeys = true;
    }

    const res = await saveRunnerSettings(hasKeys ? config : null);
    setSaving(false);
    if (res.ok) {
      onClose();
    } else {
      setError(res.error);
    }
  }

  function addEnvEntry() {
    setEnvEntries([
      ...envEntries,
      { id: nextEnvId++, key: "", value: "", inherit: false },
    ]);
  }

  function removeEnvEntry(index: number) {
    setEnvEntries(envEntries.filter((_, i) => i !== index));
  }

  function updateEnvEntry(index: number, updates: Partial<EnvEntry>) {
    setEnvEntries(
      envEntries.map((entry, i) =>
        i === index ? { ...entry, ...updates } : entry,
      ),
    );
  }

  return (
    <Modal title="Global runner settings" onClose={onClose}>
      {loading ? (
        <p className="text-sm text-zinc-400">Loading...</p>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-zinc-400">
            These defaults apply to all blocks unless overridden per-block.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-500">
                Model
              </span>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="sonnet"
                className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm placeholder:text-zinc-300 focus:border-zinc-400 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-500">
                Timeout (seconds)
              </span>
              <input
                type="number"
                min={1}
                value={timeout}
                onChange={(e) => setTimeout_(e.target.value)}
                placeholder="60"
                className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm placeholder:text-zinc-300 focus:border-zinc-400 focus:outline-none"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-500">
              Permissions
            </span>
            <select
              value={permissions}
              onChange={(e) => setPermissions(e.target.value)}
              className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm focus:border-zinc-400 focus:outline-none"
            >
              <option value="">Default (sandbox)</option>
              <option value="sandbox">Sandbox</option>
              <option value="dangerouslySkipPermissions">
                Skip permissions
              </option>
            </select>
          </label>

          {/* Environment variables */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">
                Environment variables
              </span>
              <button
                type="button"
                onClick={addEnvEntry}
                className="text-xs text-zinc-400 hover:text-zinc-600"
              >
                + Add
              </button>
            </div>
            {envEntries.map((entry, i) => (
              <div key={entry.id} className="mb-1 flex items-center gap-1">
                <input
                  type="text"
                  value={entry.key}
                  onChange={(e) => updateEnvEntry(i, { key: e.target.value })}
                  placeholder="KEY"
                  className="w-28 rounded border border-zinc-200 px-2 py-1 text-xs font-mono focus:border-zinc-400 focus:outline-none"
                />
                <span className="text-zinc-300">=</span>
                {entry.inherit ? (
                  <span className="flex-1 rounded border border-dashed border-zinc-200 px-2 py-1 text-xs text-zinc-400">
                    from system
                  </span>
                ) : (
                  <input
                    type="text"
                    value={entry.value}
                    onChange={(e) =>
                      updateEnvEntry(i, { value: e.target.value })
                    }
                    placeholder="value"
                    className="flex-1 rounded border border-zinc-200 px-2 py-1 text-xs font-mono focus:border-zinc-400 focus:outline-none"
                  />
                )}
                <label className="flex items-center gap-1 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={entry.inherit}
                    onChange={(e) =>
                      updateEnvEntry(i, { inherit: e.target.checked })
                    }
                    className="rounded"
                  />
                  inherit
                </label>
                <button
                  type="button"
                  onClick={() => removeEnvEntry(i)}
                  className="text-xs text-zinc-300 hover:text-red-500"
                >
                  x
                </button>
              </div>
            ))}
          </div>

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
      )}
    </Modal>
  );
}
