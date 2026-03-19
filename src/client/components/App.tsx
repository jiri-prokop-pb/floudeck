import { Gear } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import type { BlockRecord, DisplaySettings } from "../../types.ts";
import {
  fetchBlock,
  fetchBlocks,
  fetchDisplaySettings,
  reorderBlocksApi,
} from "../lib/api.ts";
import { CreateBlockForm } from "./CreateBlockForm.tsx";
import { Feed } from "./Feed.tsx";
import { HeaderClock } from "./HeaderClock.tsx";
import { Modal } from "./Modal.tsx";
import { SettingsModal } from "./SettingsModal.tsx";

export function App() {
  const [blocks, setBlocks] = useState<BlockRecord[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>({
    dateFormat: "D. M.",
    timeFormat: "24h",
  });

  const refetchDisplaySettings = useCallback(async () => {
    const settings = await fetchDisplaySettings();
    if (settings) {
      setDisplaySettings(settings);
    }
  }, []);

  const refetchBlocks = useCallback(async () => {
    const data = await fetchBlocks();
    setBlocks(data);
  }, []);

  const refetchBlock = useCallback(async (id: number) => {
    const block = await fetchBlock(id);
    if (block) {
      setBlocks((prev) => prev.map((b) => (b.id === id ? block : b)));
    } else {
      setBlocks((prev) => prev.filter((b) => b.id !== id));
    }
  }, []);

  useEffect(() => {
    void refetchBlocks();
    void refetchDisplaySettings();
  }, [refetchBlocks, refetchDisplaySettings]);

  useEffect(() => {
    const es = new EventSource("/api/events");

    es.addEventListener("block-updated", (event) => {
      const payload = JSON.parse((event as MessageEvent).data);
      void refetchBlock(payload.blockId);
    });

    es.addEventListener("blocks-invalidated", () => {
      void refetchBlocks();
    });

    return () => es.close();
  }, [refetchBlock, refetchBlocks]);

  function handleCreate(block: BlockRecord) {
    setBlocks((prev) => [...prev, block]);
  }

  function handleUpdate(block: BlockRecord) {
    setBlocks((prev) => prev.map((b) => (b.id === block.id ? block : b)));
  }

  function handleDelete(id: number) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  function handleReorder(orderedIds: number[]) {
    setBlocks((prev) => {
      const blockMap = new Map(prev.map((b) => [b.id, b]));
      const reordered: BlockRecord[] = [];
      for (const id of orderedIds) {
        const block = blockMap.get(id);
        if (block) reordered.push(block);
      }
      return reordered;
    });
    void reorderBlocksApi(orderedIds);
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Floudeck</h1>
            <p className="text-sm text-zinc-500">
              Your deck of signals and actions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <HeaderClock displaySettings={displaySettings} />
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600"
              title="Settings"
            >
              <Gear size={16} weight="bold" />
            </button>
          </div>
        </header>

        <Feed
          blocks={blocks}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onReorder={handleReorder}
        />

        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="mt-6 w-full rounded-2xl border border-dashed border-zinc-300 py-3 text-sm font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 hover:bg-zinc-100/50"
        >
          + Add another block
        </button>

        {showCreate && (
          <Modal title="Create block" onClose={() => setShowCreate(false)}>
            <CreateBlockForm
              onCreate={handleCreate}
              onClose={() => setShowCreate(false)}
            />
          </Modal>
        )}

        {showSettings && (
          <SettingsModal
            onClose={() => setShowSettings(false)}
            onDisplaySettingsChanged={refetchDisplaySettings}
          />
        )}
      </div>
    </div>
  );
}
