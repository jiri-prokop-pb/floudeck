import type {
  BlockRecord,
  DisplaySettings,
  ResolvedRunnerConfig,
  RunnerConfig,
} from "../../types.ts";

type ApiResponse<T> = ({ ok: true } & T) | { ok: false; error: string };

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const res = await fetch(path, options);
  return res.json();
}

export async function fetchBlocks(): Promise<BlockRecord[]> {
  const data = await apiFetch<{ blocks: BlockRecord[] }>("/api/blocks");
  return data.ok ? data.blocks : [];
}

export async function fetchBlock(id: number): Promise<BlockRecord | null> {
  const data = await apiFetch<{ block: BlockRecord }>(`/api/blocks/${id}`);
  return data.ok ? data.block : null;
}

export type BlockFormInput = {
  prompt: string;
  intervalValue: number;
  intervalUnit: string;
  runnerConfig?: RunnerConfig;
};

export async function createBlockApi(
  input: BlockFormInput,
): Promise<ApiResponse<{ block: BlockRecord }>> {
  return apiFetch("/api/blocks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateBlockApi(
  id: number,
  input: BlockFormInput,
): Promise<ApiResponse<{ block: BlockRecord }>> {
  return apiFetch(`/api/blocks/${id}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteBlockApi(
  id: number,
): Promise<ApiResponse<Record<string, never>>> {
  return apiFetch(`/api/blocks/${id}/delete`, { method: "POST" });
}

export async function refreshBlockApi(
  id: number,
): Promise<ApiResponse<{ block: BlockRecord }>> {
  return apiFetch(`/api/blocks/${id}/refresh`, { method: "POST" });
}

export async function fetchBlockDetail(id: number): Promise<{
  block: BlockRecord;
  resolvedConfig: ResolvedRunnerConfig;
  cliCommand: string;
} | null> {
  const data = await apiFetch<{
    block: BlockRecord;
    resolvedConfig: ResolvedRunnerConfig;
    cliCommand: string;
  }>(`/api/blocks/${id}`);
  return data.ok ? data : null;
}

export async function fetchRunnerSettings(): Promise<RunnerConfig | null> {
  const data = await apiFetch<{ config: RunnerConfig | null }>(
    "/api/settings/runner",
  );
  return data.ok ? data.config : null;
}

export async function saveRunnerSettings(
  config: RunnerConfig | null,
): Promise<ApiResponse<{ config: RunnerConfig | null }>> {
  return apiFetch("/api/settings/runner", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config }),
  });
}

export async function fetchDisplaySettings(): Promise<DisplaySettings | null> {
  const data = await apiFetch<{ config: DisplaySettings | null }>(
    "/api/settings/display",
  );
  return data.ok ? data.config : null;
}

export async function saveDisplaySettings(
  config: Record<string, string> | null,
): Promise<ApiResponse<{ config: DisplaySettings | null }>> {
  return apiFetch("/api/settings/display", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config }),
  });
}
