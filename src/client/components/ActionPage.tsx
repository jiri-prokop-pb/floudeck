import { ArrowLeft, CaretDown, CaretRight } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { ActionRun } from "../../types.ts";
import { fetchActionRun, runActionApi } from "../lib/api.ts";
import { renderMarkdown } from "../lib/markdown.ts";

type ActionPageProps = {
  blockUuid: string;
  actionName: string;
  params: Record<string, string>;
  onNavigateHome: () => void;
  onBlockStale: (blockUuid: string) => void;
};

function PulseSkeleton() {
  return (
    <div className="animate-pulse space-y-3 py-4">
      <div className="h-4 w-2/3 rounded bg-zinc-200" />
      <div className="h-3 w-1/2 rounded bg-zinc-200" />
      <div className="h-3 w-5/6 rounded bg-zinc-200" />
      <div className="h-3 w-3/4 rounded bg-zinc-200" />
    </div>
  );
}

export function ActionPage({
  blockUuid,
  actionName,
  params,
  onNavigateHome,
  onBlockStale,
}: ActionPageProps) {
  const [actionRun, setActionRun] = useState<ActionRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [clickId] = useState(() => {
    const url = new URL(window.location.href);
    const existing = url.searchParams.get("_cid");
    if (existing) return existing;
    const id = crypto.randomUUID();
    url.searchParams.set("_cid", id);
    window.history.replaceState(null, "", url.toString());
    return id;
  });

  useEffect(() => {
    let cancelled = false;

    async function startAction() {
      const result = await runActionApi({
        clickId,
        blockUuid,
        actionName,
        params,
      });

      if (cancelled) return;

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setActionRun(result.actionRun);

      if (
        result.actionRun.status === "completed" ||
        result.actionRun.status === "error"
      ) {
        onBlockStale(blockUuid);
        return;
      }

      // Listen for SSE completion
      const es = new EventSource("/api/events");
      es.addEventListener("action-updated", async (event) => {
        const payload = JSON.parse((event as MessageEvent).data);
        if (payload.clickId !== clickId) return;

        es.close();
        if (cancelled) return;

        const updated = await fetchActionRun(clickId);
        if (updated && !cancelled) {
          setActionRun(updated);
          onBlockStale(blockUuid);
        }
      });

      return () => {
        es.close();
      };
    }

    let cleanup: (() => void) | undefined;
    void startAction().then((c) => {
      if (typeof c === "function") cleanup = c;
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [clickId, blockUuid, actionName, params, onBlockStale]);

  const isLoading =
    !actionRun ||
    actionRun.status === "pending" ||
    actionRun.status === "running";
  const hasError =
    error ?? (actionRun?.status === "error" ? actionRun.error_text : null);

  const composedPrompt = `--- Block Context ---\n(block output loaded at runtime)\n\n--- Action ---\nAction: ${actionName}${
    Object.keys(params).length > 0
      ? `\nParameters:\n${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join("\n")}`
      : ""
  }`;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-6">
          <button
            type="button"
            onClick={onNavigateHome}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 mb-3"
          >
            <ArrowLeft size={14} weight="bold" />
            Back to feed
          </button>
          <h1 className="text-xl font-bold text-zinc-900">
            {formatActionName(actionName)}
          </h1>
        </header>

        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="px-5 py-4">
            {hasError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                <p className="font-medium mb-1">Action failed</p>
                <p>{hasError}</p>
              </div>
            )}

            {isLoading && !hasError && <PulseSkeleton />}

            {actionRun?.status === "completed" && actionRun.output_markdown && (
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(actionRun.output_markdown),
                }}
              />
            )}
          </div>
        </div>

        {/* Debug: Show prompt */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowPrompt(!showPrompt)}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600"
          >
            {showPrompt ? (
              <CaretDown size={12} weight="bold" />
            ) : (
              <CaretRight size={12} weight="bold" />
            )}
            Show prompt
          </button>
          {showPrompt && (
            <pre className="mt-2 rounded-lg bg-zinc-100 p-3 text-xs text-zinc-600 overflow-x-auto whitespace-pre-wrap">
              {composedPrompt}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function formatActionName(name: string): string {
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
