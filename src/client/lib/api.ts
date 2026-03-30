import type {
  ActionRun,
  BlockRecord,
  DebugEvent,
  DisplaySettings,
  PermissionErrorInfo,
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
  tryResult?: string;
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

export async function reorderBlocksApi(
  orderedIds: number[],
): Promise<ApiResponse<Record<string, never>>> {
  return apiFetch("/api/blocks/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderedIds }),
  });
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
  config: Record<string, string | boolean> | null,
): Promise<ApiResponse<{ config: DisplaySettings | null }>> {
  return apiFetch("/api/settings/display", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config }),
  });
}

// --- Try ---

export async function tryBlockApi(input: {
  prompt: string;
  runnerConfig?: RunnerConfig;
}): Promise<ApiResponse<{ markdown: string }>> {
  return apiFetch("/api/blocks/try", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export type TryStreamCallbacks = {
  onText: (text: string) => void;
  onDebug: (event: DebugEvent) => void;
  onDone: (markdown: string, reasoning: string | null) => void;
  onError: (error: string, permissionError?: PermissionErrorInfo) => void;
};

export function tryBlockStreamApi(
  input: {
    prompt: string;
    runnerConfig?: RunnerConfig;
    debug?: boolean;
    blockUuid?: string;
  },
  callbacks: TryStreamCallbacks,
): AbortController {
  const controller = new AbortController();

  void (async () => {
    try {
      const res = await fetch("/api/blocks/try", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res
          .json()
          .catch(() => ({ error: "Request failed" }));
        callbacks.onError(
          typeof data === "object" && data && "error" in data
            ? String(data.error)
            : "Request failed",
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          if (!block.trim()) continue;
          let eventType = "";
          let data = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event: ")) eventType = line.slice(7);
            if (line.startsWith("data: ")) data = line.slice(6);
          }
          if (!eventType || !data) continue;

          try {
            const parsed = JSON.parse(data);
            switch (eventType) {
              case "text":
                callbacks.onText(parsed.text);
                break;
              case "debug":
                callbacks.onDebug(parsed);
                break;
              case "done":
                callbacks.onDone(parsed.markdown, parsed.reasoning ?? null);
                break;
              case "error":
                callbacks.onError(parsed.error, parsed.permissionError);
                break;
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      callbacks.onError(
        err instanceof Error ? err.message : "Streaming failed",
      );
    }
  })();

  return controller;
}

// --- Actions ---

export async function runActionApi(input: {
  clickId: string;
  blockUuid: string;
  actionName: string;
  params: Record<string, string>;
}): Promise<ApiResponse<{ actionRun: ActionRun; blockTitle: string | null }>> {
  return apiFetch("/api/actions/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function fetchActionRun(
  clickId: string,
): Promise<{ actionRun: ActionRun; blockTitle: string | null } | null> {
  const data = await apiFetch<{
    actionRun: ActionRun;
    blockTitle: string | null;
  }>(`/api/actions/${clickId}`);
  return data.ok
    ? { actionRun: data.actionRun, blockTitle: data.blockTitle }
    : null;
}
