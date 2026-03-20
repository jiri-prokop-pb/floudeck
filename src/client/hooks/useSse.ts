import { useEffect } from "react";

type SseCallbacks = {
  onBlockUpdated: (blockId: number) => void;
  onBlocksInvalidated: () => void;
};

export function useSse({ onBlockUpdated, onBlocksInvalidated }: SseCallbacks) {
  useEffect(() => {
    const es = new EventSource("/api/events");

    es.addEventListener("block-updated", (event) => {
      const payload = JSON.parse((event as MessageEvent).data);
      onBlockUpdated(payload.blockId);
    });

    es.addEventListener("blocks-invalidated", () => {
      onBlocksInvalidated();
    });

    return () => es.close();
  }, [onBlockUpdated, onBlocksInvalidated]);
}
