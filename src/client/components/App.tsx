import { useCallback, useEffect, useState } from "react";
import type { BlockRecord } from "../../types.ts";
import { fetchBlock, fetchBlocks } from "../lib/api.ts";
import { CreateBlockForm } from "./CreateBlockForm.tsx";
import { Feed } from "./Feed.tsx";
import { Modal } from "./Modal.tsx";

export function App() {
  const [blocks, setBlocks] = useState<BlockRecord[]>([]);
  const [showCreate, setShowCreate] = useState(false);

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
  }, [refetchBlocks]);

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

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900">Floudeck</h1>
          <p className="text-sm text-zinc-500">
            Your deck of signals and actions
          </p>
        </header>

        <Feed blocks={blocks} onUpdate={handleUpdate} onDelete={handleDelete} />

        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="mt-6 w-full rounded-2xl border border-dashed border-zinc-300 py-3 text-sm font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 hover:bg-zinc-100/50"
        >
          + Add another block
        </button>

        {showCreate && (
          <Modal
            title="Create block"
            subtitle="Compact entry point, full form only when needed."
            onClose={() => setShowCreate(false)}
          >
            <CreateBlockForm
              onCreate={handleCreate}
              onClose={() => setShowCreate(false)}
            />
          </Modal>
        )}
      </div>
    </div>
  );
}
