import { ArrowLeft } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { BlockRecord } from "../../types.ts";
import { safeParseRunnerConfig } from "../../validate.ts";
import { createBlockApi, fetchBlock, updateBlockApi } from "../lib/api.ts";
import { BlockForm } from "./BlockForm.tsx";

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
  const [block, setBlock] = useState<BlockRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    async function load() {
      const b = await fetchBlock(blockId);
      if (cancelled) return;
      if (b) {
        setBlock(b);
      } else {
        setLoadError("Block not found");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [isEdit, blockId]);

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
            {loadError && <p className="text-sm text-red-600">{loadError}</p>}

            {isEdit && !block && !loadError && (
              <p className="text-sm text-zinc-400">Loading...</p>
            )}

            {(!isEdit || block) && !loadError && (
              <BlockForm
                key={block?.id}
                initialPrompt={block?.prompt}
                initialIntervalValue={block?.interval_value}
                initialIntervalUnit={block?.interval_unit}
                initialRunnerConfig={
                  block ? safeParseRunnerConfig(block.runner_config) : undefined
                }
                blockUuid={block?.uuid}
                submitLabel={isEdit ? "Save" : "Add block"}
                onCancel={onNavigateHome}
                onSubmit={async (data) => {
                  if (isEdit && block) {
                    const res = await updateBlockApi(block.id, data);
                    if (res.ok) {
                      onUpdate(res.block);
                      onNavigateHome();
                      return {};
                    }
                    return { error: res.error };
                  }
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
