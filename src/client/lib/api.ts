import type { BlockRecord } from "../../types.ts";

type ApiResponse<T> = { ok: true } & T | { ok: false; error: string };

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

export async function createBlockApi(input: {
  prompt: string;
  intervalValue: number;
  intervalUnit: string;
}): Promise<ApiResponse<{ block: BlockRecord }>> {
  return apiFetch("/api/blocks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateBlockApi(
  id: number,
  input: {
    prompt: string;
    intervalValue: number;
    intervalUnit: string;
  },
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
