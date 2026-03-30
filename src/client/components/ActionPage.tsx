import { ArrowLeft, CaretDown, CaretRight } from "@phosphor-icons/react";
import { useActionState, useEffect, useRef, useState } from "react";
import type { ActionDefinition, ActionRun } from "../../types.ts";
import { fetchActionRun, fetchBlockByUuid, runActionApi } from "../lib/api.ts";
import { renderMarkdown } from "../lib/markdown.ts";
import { PulseSkeleton } from "./PulseSkeleton.tsx";

type ActionPageProps = {
  blockUuid: string;
  actionName: string;
  params: Record<string, string>;
  onNavigateHome: () => void;
  onBlockStale: (blockUuid: string) => void;
};

function isTerminal(run: ActionRun): boolean {
  return run.status === "completed" || run.status === "error";
}

export function ActionPage({
  blockUuid,
  actionName,
  params,
  onNavigateHome,
  onBlockStale,
}: ActionPageProps) {
  const [blockType, setBlockType] = useState<string | null>(null);
  const [actionDef, setActionDef] = useState<ActionDefinition | null>(null);
  const [actionRun, setActionRun] = useState<ActionRun | null>(null);
  const [blockTitle, setBlockTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [userInput, setUserInput] = useState("");
  const paramsRef = useRef(params);

  const [clickId, setClickId] = useState(() => {
    const url = new URL(window.location.href);
    const existing = url.searchParams.get("_cid");
    if (existing) return existing;
    return null;
  });

  // For action blocks: fetch block info first to determine mode
  useEffect(() => {
    let cancelled = false;
    async function loadBlockInfo() {
      const data = await fetchBlockByUuid(blockUuid);
      if (cancelled) return;
      if (!data) {
        setError("Block not found");
        return;
      }
      setBlockType(data.block.block_type);
      if (data.block.title) setBlockTitle(data.block.title);
      if (data.block.block_type === "action") {
        const def = data.parsedActions.find((a) => a.name === actionName);
        if (!def) {
          setError(`Action "${actionName}" not found`);
          return;
        }
        setActionDef(def);
      }
    }
    void loadBlockInfo();
    return () => {
      cancelled = true;
    };
  }, [blockUuid, actionName]);

  // For scheduled blocks: auto-run on mount (existing behavior)
  useEffect(() => {
    if (blockType !== "scheduled") return;

    // Generate or reuse clickId
    let cid = clickId;
    if (!cid) {
      cid = crypto.randomUUID();
      const url = new URL(window.location.href);
      url.searchParams.set("_cid", cid);
      window.history.replaceState(null, "", url.toString());
      setClickId(cid);
    }

    let cancelled = false;
    let es: EventSource | null = null;
    const currentClickId = cid;

    async function startAction() {
      const result = await runActionApi({
        clickId: currentClickId,
        blockUuid,
        actionName,
        params: paramsRef.current,
      });

      if (cancelled) return;

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setActionRun(result.actionRun);
      if (result.blockTitle) setBlockTitle(result.blockTitle);

      if (isTerminal(result.actionRun)) {
        onBlockStale(blockUuid);
        return;
      }

      es = new EventSource("/api/events");
      es.addEventListener("action-updated", async (event) => {
        const payload = JSON.parse((event as MessageEvent).data);
        if (payload.clickId !== currentClickId) return;

        es?.close();
        es = null;
        if (cancelled) return;

        const updated = await fetchActionRun(currentClickId);
        if (updated && !cancelled) {
          setActionRun(updated.actionRun);
          if (updated.blockTitle) setBlockTitle(updated.blockTitle);
          onBlockStale(blockUuid);
        }
      });

      const updated = await fetchActionRun(currentClickId);
      if (cancelled) return;
      if (updated && isTerminal(updated.actionRun)) {
        es?.close();
        es = null;
        setActionRun(updated.actionRun);
        if (updated.blockTitle) setBlockTitle(updated.blockTitle);
        onBlockStale(blockUuid);
      }
    }

    void startAction();

    return () => {
      cancelled = true;
      es?.close();
    };
  }, [blockType, clickId, blockUuid, actionName, onBlockStale]);

  // Action block submission
  const [submitError, submitAction, isSubmitting] = useActionState(
    async (_prev: string | null) => {
      const cid = crypto.randomUUID();
      const url = new URL(window.location.href);
      url.searchParams.set("_cid", cid);
      window.history.replaceState(null, "", url.toString());

      const result = await runActionApi({
        clickId: cid,
        blockUuid,
        actionName,
        input: userInput,
      });

      if (!result.ok) return result.error;

      setActionRun(result.actionRun);
      if (result.blockTitle) setBlockTitle(result.blockTitle);
      setClickId(cid);

      if (!isTerminal(result.actionRun)) {
        // Listen for SSE completion
        const es = new EventSource("/api/events");
        es.addEventListener("action-updated", async (event) => {
          const payload = JSON.parse((event as MessageEvent).data);
          if (payload.clickId !== cid) return;
          es.close();
          const updated = await fetchActionRun(cid);
          if (updated) {
            setActionRun(updated.actionRun);
            if (updated.blockTitle) setBlockTitle(updated.blockTitle);
          }
        });
      }
      return null;
    },
    null,
  );

  const isLoading =
    !actionRun ||
    actionRun.status === "pending" ||
    actionRun.status === "running";
  const hasError =
    error ?? (actionRun?.status === "error" ? actionRun.error_text : null);

  const composedPrompt =
    blockType === "action" && actionDef
      ? actionDef.prompt
      : `--- Block Context ---\n(block output loaded at runtime)\n\n--- Action ---\nAction: ${actionName}${
          Object.keys(paramsRef.current).length > 0
            ? `\nParameters:\n${Object.entries(paramsRef.current)
                .map(([k, v]) => `${k}=${v}`)
                .join("\n")}`
            : ""
        }`;

  // Show input form for action blocks before submission
  const showInputForm =
    blockType === "action" && actionDef && !actionRun && !error;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-6">
          <button
            type="button"
            onClick={onNavigateHome}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 mb-3 cursor-pointer"
          >
            <ArrowLeft size={14} weight="bold" />
            Back to feed
          </button>
          <h1 className="text-xl font-bold text-zinc-900">
            {blockTitle ? (
              <>
                <span className="text-zinc-400">{blockTitle}</span>
                <span className="text-zinc-300 mx-1.5">/</span>
                {formatActionName(actionName)}
              </>
            ) : (
              formatActionName(actionName)
            )}
          </h1>
        </header>

        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="px-5 py-4">
            {showInputForm && (
              <form action={submitAction} className="space-y-3">
                <textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Enter your input..."
                  rows={4}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
                />
                {submitError && (
                  <p className="text-sm text-red-600">{submitError}</p>
                )}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-lg bg-zinc-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                  >
                    {isSubmitting ? "Running..." : "Run"}
                  </button>
                </div>
              </form>
            )}

            {/* Loading state while fetching block info */}
            {blockType === null && !error && (
              <PulseSkeleton widths={["w-2/3", "w-1/2"]} />
            )}

            {hasError && !showInputForm && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                <p className="font-medium mb-1">Action failed</p>
                <p>{hasError}</p>
              </div>
            )}

            {actionRun && isLoading && !hasError && (
              <PulseSkeleton widths={["w-2/3", "w-1/2", "w-5/6", "w-3/4"]} />
            )}

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
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 cursor-pointer"
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
