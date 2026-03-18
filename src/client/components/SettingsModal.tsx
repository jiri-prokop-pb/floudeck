import { useEffect, useState } from "react";
import type { RunnerConfig } from "../../types.ts";
import { fetchRunnerSettings, saveRunnerSettings } from "../lib/api.ts";
import { Modal } from "./Modal.tsx";
import {
  type EnvEntry,
  entriesToEnv,
  parseEnvEntries,
  RunnerConfigFields,
} from "./RunnerConfigFields.tsx";

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

  return (
    <Modal title="Global runner settings" onClose={onClose}>
      {loading ? (
        <p className="text-sm text-zinc-400">Loading...</p>
      ) : (
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
      )}
    </Modal>
  );
}
