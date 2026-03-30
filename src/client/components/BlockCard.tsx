import { useSortable } from "@dnd-kit/sortable";
import { DotsSixVertical, Info, List } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import type { BlockRecord } from "../../types.ts";
import { useClickOutside } from "../hooks/useClickOutside.ts";
import { deleteBlockApi, refreshBlockApi } from "../lib/api.ts";
import {
  formatSchedule,
  formatTimeAgo,
  formatTimeUntil,
} from "../lib/format.ts";
import { BlockBody } from "./BlockBody.tsx";
import { Modal } from "./Modal.tsx";

type BlockCardProps = {
  block: BlockRecord;
  compact?: boolean;
  onUpdate: (block: BlockRecord) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number) => void;
};

export function BlockCard({
  block,
  compact,
  onUpdate,
  onDelete,
  onEdit,
}: BlockCardProps) {
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, () => setShowMenu(false));
  useClickOutside(infoRef, () => setShowInfo(false));

  async function handleRefresh() {
    setShowMenu(false);
    setLoading(true);
    const res = await refreshBlockApi(block.id);
    if (res.ok) onUpdate(res.block);
    setLoading(false);
  }

  async function handleDelete() {
    setConfirmingDelete(false);
    const res = await deleteBlockApi(block.id);
    if (res.ok) onDelete(block.id);
  }

  return (
    <div
      className={`relative ${compact ? "rounded-xl" : "rounded-2xl"} border border-zinc-200 bg-white shadow-sm ${showMenu || showInfo ? "z-30" : ""}`}
    >
      <div className="absolute right-3 top-3 flex items-center gap-1 z-10">
        {/* Info button */}
        <div ref={infoRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setShowMenu(false);
              setShowInfo(!showInfo);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 text-sm"
            title="Info"
          >
            {block.status === "running" ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-green-300 border-t-green-600" />
            ) : (
              <Info size={16} weight="bold" />
            )}
          </button>
          {showInfo && (
            <div className="absolute right-0 top-8 w-56 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg text-xs text-zinc-600 space-y-1 z-20">
              {block.status === "running" && (
                <div className="flex items-center gap-1.5 text-green-600 font-medium">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border border-green-300 border-t-green-600" />
                  Refreshing...
                </div>
              )}
              <div>
                <span className="font-medium text-zinc-500">Refresh: </span>
                {formatSchedule(block.interval_value, block.interval_unit)}
              </div>
              <div>
                <span className="font-medium text-zinc-500">Last run: </span>
                {block.last_run_at
                  ? formatTimeAgo(block.last_run_at)
                  : "Not yet run"}
              </div>
              <div>
                <span className="font-medium text-zinc-500">Next run: </span>
                {block.status === "running"
                  ? "Running now"
                  : block.next_run_at
                    ? formatTimeUntil(block.next_run_at)
                    : "\u2014"}
              </div>
            </div>
          )}
        </div>

        {/* Menu button */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setShowInfo(false);
              setShowMenu(!showMenu);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 text-sm"
            title="Menu"
          >
            <List size={14} weight="bold" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-8 w-36 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading || block.status === "running"}
                className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onEdit(block.id);
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  setConfirmingDelete(true);
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className={compact ? "px-4 py-3" : "px-5 py-4"}>
        <BlockBody block={block} compact={compact} />
      </div>

      {confirmingDelete && (
        <Modal title="Delete block" onClose={() => setConfirmingDelete(false)}>
          <p className="text-sm text-zinc-600 mb-4">
            Are you sure you want to delete this block? This action cannot be
            undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function SortableBlockCard(props: BlockCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.block.id });

  const style = {
    transform: transform
      ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
      : undefined,
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`group/sortable relative ${isDragging ? "z-50" : ""}`}
    >
      <div
        className={`relative ${props.compact ? "rounded-xl" : "rounded-2xl"} transition-[transform,box-shadow] duration-200 ${isDragging ? "scale-105 shadow-xl" : ""}`}
      >
        <button
          type="button"
          {...listeners}
          className="absolute -left-8 top-0 bottom-0 flex w-8 items-center justify-center text-zinc-300 opacity-0 group-hover/sortable:opacity-100 focus:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        >
          <DotsSixVertical size={18} weight="bold" />
        </button>
        <BlockCard {...props} />
      </div>
    </div>
  );
}
