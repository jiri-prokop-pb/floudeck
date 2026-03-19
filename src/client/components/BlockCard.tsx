import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSixVertical, Info, List } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import type { BlockRecord } from "../../types.ts";
import { safeParseRunnerConfig } from "../../validate.ts";
import { useClickOutside } from "../hooks/useClickOutside.ts";
import { deleteBlockApi, refreshBlockApi, updateBlockApi } from "../lib/api.ts";
import {
  formatSchedule,
  formatTimeAgo,
  formatTimeUntil,
} from "../lib/format.ts";
import { BlockBody } from "./BlockBody.tsx";
import { BlockForm } from "./BlockForm.tsx";

type BlockCardProps = {
  block: BlockRecord;
  onUpdate: (block: BlockRecord) => void;
  onDelete: (id: number) => void;
};

export function BlockCard({ block, onUpdate, onDelete }: BlockCardProps) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
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
    setShowMenu(false);
    if (!confirm("Delete this block?")) return;
    const res = await deleteBlockApi(block.id);
    if (res.ok) onDelete(block.id);
  }

  return (
    <div className="relative rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {/* Icon buttons — hidden while editing */}
      {!editing && (
        <div className="absolute right-3 top-3 flex items-center gap-1 z-10">
          {/* Info button */}
          <div ref={infoRef} className="relative">
            <button
              type="button"
              onClick={() => setShowInfo(!showInfo)}
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
              onClick={() => setShowMenu(!showMenu)}
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
                    setEditing(!editing);
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="border-b border-zinc-100 bg-zinc-50 px-5 py-4 rounded-t-2xl">
          <BlockForm
            initialPrompt={block.prompt}
            initialIntervalValue={block.interval_value}
            initialIntervalUnit={block.interval_unit}
            initialRunnerConfig={safeParseRunnerConfig(block.runner_config)}
            blockUuid={block.uuid}
            submitLabel="Save"
            onCancel={() => setEditing(false)}
            onSubmit={async (data) => {
              const res = await updateBlockApi(block.id, data);
              if (res.ok) {
                onUpdate(res.block);
                setEditing(false);
                return {};
              }
              return { error: res.error };
            }}
          />
        </div>
      )}

      {/* Body */}
      <div className="px-5 py-4">
        <BlockBody block={block} />
      </div>
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
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`group/sortable relative ${isDragging ? "z-50" : ""}`}
    >
      <button
        type="button"
        {...listeners}
        className="absolute -left-8 top-0 bottom-0 flex w-8 items-center justify-center text-zinc-300 opacity-0 group-hover/sortable:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        tabIndex={-1}
      >
        <DotsSixVertical size={18} weight="bold" />
      </button>
      <BlockCard {...props} />
    </div>
  );
}
