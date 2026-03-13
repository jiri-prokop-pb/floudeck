import type { BlockRecord } from "../../types.ts";
import { BlockCard } from "./BlockCard.tsx";

type FeedProps = {
  blocks: BlockRecord[];
  onUpdate: (block: BlockRecord) => void;
  onDelete: (id: number) => void;
};

export function Feed({ blocks, onUpdate, onDelete }: FeedProps) {
  if (blocks.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-400">
        No blocks yet. Add your first scheduled block above.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <BlockCard
          key={block.id}
          block={block}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
