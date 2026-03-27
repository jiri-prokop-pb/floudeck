import { X } from "@phosphor-icons/react";
import { ENV_INHERIT_SENTINEL } from "../../types.ts";

export type EnvEntry = {
  id: number;
  key: string;
  value: string;
  inherit: boolean;
};

let nextEnvId = 1;

export function parseEnvEntries(env?: Record<string, string>): EnvEntry[] {
  if (!env || Object.keys(env).length === 0) return [];
  return Object.entries(env).map(([key, value]) => ({
    id: nextEnvId++,
    key,
    value: value === ENV_INHERIT_SENTINEL ? "" : value,
    inherit: value === ENV_INHERIT_SENTINEL,
  }));
}

export function entriesToEnv(
  entries: EnvEntry[],
): Record<string, string> | undefined {
  const filtered = entries.filter((e) => e.key.trim());
  if (filtered.length === 0) return undefined;
  const env: Record<string, string> = {};
  for (const entry of filtered) {
    env[entry.key.trim()] = entry.inherit ? ENV_INHERIT_SENTINEL : entry.value;
  }
  return env;
}

export type RunnerConfigFieldsProps = {
  model: string;
  onModelChange: (v: string) => void;
  timeout: string;
  onTimeoutChange: (v: string) => void;
  permissions: string;
  onPermissionsChange: (v: string) => void;
  envEntries: EnvEntry[];
  onEnvChange: (entries: EnvEntry[]) => void;
};

function addEntry(entries: EnvEntry[], onChange: (e: EnvEntry[]) => void) {
  onChange([
    ...entries,
    { id: nextEnvId++, key: "", value: "", inherit: false },
  ]);
}

function removeEntry(
  entries: EnvEntry[],
  index: number,
  onChange: (e: EnvEntry[]) => void,
) {
  onChange(entries.filter((_, i) => i !== index));
}

function updateEntry(
  entries: EnvEntry[],
  index: number,
  updates: Partial<EnvEntry>,
  onChange: (e: EnvEntry[]) => void,
) {
  onChange(
    entries.map((entry, i) => (i === index ? { ...entry, ...updates } : entry)),
  );
}

export function RunnerConfigFields({
  model,
  onModelChange,
  timeout,
  onTimeoutChange,
  permissions,
  onPermissionsChange,
  envEntries,
  onEnvChange,
}: RunnerConfigFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-500">
            Model
          </span>
          <input
            type="text"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            placeholder="sonnet"
            className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm placeholder:text-zinc-300 focus:border-zinc-400 focus:outline-none"
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
            onChange={(e) => onTimeoutChange(e.target.value)}
            placeholder="60"
            className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm placeholder:text-zinc-300 focus:border-zinc-400 focus:outline-none"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-zinc-500">
          Permissions
        </span>
        <select
          value={permissions}
          onChange={(e) => onPermissionsChange(e.target.value)}
          className="h-9 w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm focus:border-zinc-400 focus:outline-none"
        >
          <option value="">Default (use Claude settings)</option>
          <option value="dangerouslySkipPermissions">Skip permissions</option>
        </select>
      </label>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-500">
            Environment variables
          </span>
          <button
            type="button"
            onClick={() => addEntry(envEntries, onEnvChange)}
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
              onChange={(e) =>
                updateEntry(envEntries, i, { key: e.target.value }, onEnvChange)
              }
              placeholder="KEY"
              className="w-28 rounded border border-zinc-200 bg-white px-2 py-1 text-xs font-mono focus:border-zinc-400 focus:outline-none"
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
                  updateEntry(
                    envEntries,
                    i,
                    { value: e.target.value },
                    onEnvChange,
                  )
                }
                placeholder="value"
                className="flex-1 rounded border border-zinc-200 bg-white px-2 py-1 text-xs font-mono focus:border-zinc-400 focus:outline-none"
              />
            )}
            <label className="flex items-center gap-1 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={entry.inherit}
                onChange={(e) =>
                  updateEntry(
                    envEntries,
                    i,
                    { inherit: e.target.checked },
                    onEnvChange,
                  )
                }
                className="rounded"
              />
              inherit
            </label>
            <button
              type="button"
              onClick={() => removeEntry(envEntries, i, onEnvChange)}
              className="text-xs text-zinc-300 hover:text-red-500"
            >
              <X size={12} weight="bold" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
