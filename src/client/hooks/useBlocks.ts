import { useCallback, useEffect, useState } from "react";
import type { BlockRecord } from "../../types.ts";
import {
  fetchBlock,
  fetchBlocks,
  refreshBlockApi,
  reorderBlocksApi,
} from "../lib/api.ts";

export function useBlocks() {
  const [blocks, setBlocks] = useState<BlockRecord[]>([]);
  const [staleBlockUuids, setStaleBlockUuids] = useState<Set<string>>(
    new Set(),
  );

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

  const handleBlockStale = useCallback((blockUuid: string) => {
    setStaleBlockUuids((prev) => new Set([...prev, blockUuid]));
  }, []);

  const refreshStaleBlocks = useCallback(() => {
    if (staleBlockUuids.size === 0) return;
    const uuids = new Set(staleBlockUuids);
    setStaleBlockUuids(new Set());
    for (const block of blocks) {
      if (uuids.has(block.uuid)) {
        void refreshBlockApi(block.id);
      }
    }
  }, [staleBlockUuids, blocks]);

  return {
    blocks,
    refetchBlocks,
    refetchBlock,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleReorder,
    handleBlockStale,
    refreshStaleBlocks,
  };
}
