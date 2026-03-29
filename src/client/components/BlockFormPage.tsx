import { ArrowLeft } from "@phosphor-icons/react";
import { Suspense, use, useState } from "react";
import type { BlockRecord } from "../../types.ts";
import { safeParseRunnerConfig } from "../../validate.ts";
import { createBlockApi, fetchBlock, updateBlockApi } from "../lib/api.ts";
import { BlockForm } from "./BlockForm.tsx";
import { ErrorBoundary } from "./ErrorBoundary.tsx";

type BlockFormPageProps = {
  blockId?: number;
  onNavigateHome: () => void;
  onCreate: (block: BlockRecord) => void;
  onUpdate: (block: BlockRecord) => void;
};

export function BlockFormPage({
  blockId,
  onNavigateHome,
  onCreate,
  onUpdate,
}: BlockFormPageProps) {
  const isEdit = blockId !== undefined;
  const [blockPromise] = useState(() => (isEdit ? fetchBlock(blockId) : null));

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
            {isEdit ? "Edit block" : "Create block"}
          </h1>
        </header>

        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="px-5 py-4">
            {isEdit && blockPromise ? (
              <ErrorBoundary
                fallback={
                  <p className="text-sm text-red-600">Failed to load block</p>
                }
              >
                <Suspense
                  fallback={<p className="text-sm text-zinc-400">Loading...</p>}
                >
                  <EditBlockFormLoader
                    blockPromise={blockPromise}
                    onNavigateHome={onNavigateHome}
                    onUpdate={onUpdate}
                  />
                </Suspense>
              </ErrorBoundary>
            ) : (
              <BlockForm
                submitLabel="Add block"
                onCancel={onNavigateHome}
                onSubmit={async (data) => {
                  const res = await createBlockApi(data);
                  if (res.ok) {
                    onCreate(res.block);
                    onNavigateHome();
                    return {};
                  }
                  return { error: res.error };
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditBlockFormLoader({
  blockPromise,
  onNavigateHome,
  onUpdate,
}: {
  blockPromise: Promise<BlockRecord | null>;
  onNavigateHome: () => void;
  onUpdate: (block: BlockRecord) => void;
}) {
  const block = use(blockPromise);

  if (!block) {
    return <p className="text-sm text-red-600">Block not found</p>;
  }

  return (
    <BlockForm
      key={block.id}
      initialPrompt={block.prompt}
      initialIntervalValue={block.interval_value}
      initialIntervalUnit={block.interval_unit}
      initialRunnerConfig={safeParseRunnerConfig(block.runner_config)}
      blockUuid={block.uuid}
      submitLabel="Save"
      onCancel={onNavigateHome}
      onSubmit={async (data) => {
        const res = await updateBlockApi(block.id, data);
        if (res.ok) {
          onUpdate(res.block);
          onNavigateHome();
          return {};
        }
        return { error: res.error };
      }}
    />
  );
}
