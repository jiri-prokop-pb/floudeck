import type { DebugEvent, PermissionErrorInfo } from "../../types.ts";
import { extractTitle, renderMarkdown } from "../lib/markdown.ts";
import { DebugPanel } from "./DebugPanel.tsx";
import { PulseSkeleton } from "./PulseSkeleton.tsx";

export type TryState =
  | { status: "idle" }
  | { status: "running"; partialText: string; debugEvents: DebugEvent[] }
  | {
      status: "success";
      markdown: string;
      reasoning: string | null;
      debugEvents: DebugEvent[];
    }
  | {
      status: "error";
      error: string;
      permissionError?: PermissionErrorInfo;
      debugEvents: DebugEvent[];
      debugMode?: boolean;
    };

type TryPanelProps = {
  state: TryState;
};

export function TryPanel({ state }: TryPanelProps) {
  if (state.status === "idle") return null;

  if (state.status === "running") {
    const hasText = state.partialText.length > 0;
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
          {hasText ? (
            <div
              className="prose prose-sm max-w-none prose-headings:text-sm prose-headings:font-semibold prose-h1:text-base prose-h2:text-[0.9rem] prose-h3:text-[0.85rem]"
              dangerouslySetInnerHTML={{
                __html: renderMarkdown(state.partialText),
              }}
            />
          ) : (
            <PulseSkeleton />
          )}
        </div>
        <DebugPanel events={state.debugEvents} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{state.error}</p>
          {state.permissionError && state.debugMode && (
            <div className="mt-2 rounded border border-red-100 bg-white p-3">
              <p className="text-xs text-red-500">
                {state.permissionError.instructions}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                CWD:{" "}
                <code className="rounded bg-zinc-100 px-1">
                  {state.permissionError.cwd}
                </code>
              </p>
            </div>
          )}
          {state.permissionError && !state.debugMode && (
            <p className="mt-1 text-xs text-red-400">
              Enable debug mode for details.
            </p>
          )}
        </div>
        <DebugPanel events={state.debugEvents} />
      </div>
    );
  }

  // success
  const { title, body } = extractTitle(state.markdown);
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        {title && (
          <h3 className="mb-2 text-base font-semibold text-zinc-900">
            {title}
          </h3>
        )}
        {body && (
          <div
            className="prose prose-sm max-w-none prose-headings:text-sm prose-headings:font-semibold prose-h2:text-[0.9rem] prose-h3:text-[0.85rem]"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
          />
        )}
      </div>
      <DebugPanel events={state.debugEvents} />
    </div>
  );
}
