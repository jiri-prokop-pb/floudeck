import type { DragEndEvent } from "@dnd-kit/core";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { BlockRecord } from "../../types.ts";
import { SortableBlockCard } from "./BlockCard.tsx";

type FeedProps = {
  blocks: BlockRecord[];
  compact?: boolean;
  onUpdate: (block: BlockRecord) => void;
  onDelete: (id: number) => void;
  onReorder: (orderedIds: number[]) => void;
  onEdit: (id: number) => void;
};

export function Feed({
  blocks,
  compact,
  onUpdate,
  onDelete,
  onReorder,
  onEdit,
}: FeedProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  if (blocks.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-400">
        No blocks yet. Add your first scheduled block above.
      </p>
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(blocks, oldIndex, newIndex);
    onReorder(reordered.map((b) => b.id));
  }

  const blockIds = blocks.map((b) => b.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
        <div className={compact ? "space-y-2" : "space-y-4"}>
          {blocks.map((block) => (
            <SortableBlockCard
              key={block.id}
              block={block}
              compact={compact}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
