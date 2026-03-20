import type { RunnerConfig } from "../../types.ts";
import {
  type EnvEntry,
  entriesToEnv,
} from "../components/RunnerConfigFields.tsx";

type RunnerConfigFields = {
  model: string;
  permissions: string;
  timeout: string;
  envEntries: EnvEntry[];
  cwd?: string;
};

export function buildRunnerConfig(
  fields: RunnerConfigFields,
): RunnerConfig | undefined {
  const config: RunnerConfig = {};
  let hasKeys = false;

  if (fields.model.trim()) {
    config.model = fields.model.trim();
    hasKeys = true;
  }
  if (fields.cwd?.trim()) {
    config.cwd = fields.cwd.trim();
    hasKeys = true;
  }
  if (
    fields.permissions === "default" ||
    fields.permissions === "dangerouslySkipPermissions"
  ) {
    config.permissions = fields.permissions;
    hasKeys = true;
  }
  const timeoutNum = Number(fields.timeout);
  if (fields.timeout.trim() && timeoutNum > 0) {
    config.timeout = timeoutNum;
    hasKeys = true;
  }
  const env = entriesToEnv(fields.envEntries);
  if (env) {
    config.env = env;
    hasKeys = true;
  }

  return hasKeys ? config : undefined;
}
