import { useRef, useState } from "react";
import type { BlockRecord, RunnerConfig } from "../../types.ts";
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

function parseRunnerConfig(block: BlockRecord): RunnerConfig | undefined {
  if (!block.runner_config) return undefined;
  try {
    return JSON.parse(block.runner_config) as RunnerConfig;
  } catch {
    return undefined;
  }
}

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
                "\u24D8"
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
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <title>Menu</title>
                <line x1="2" y1="3.5" x2="12" y2="3.5" />
                <line x1="2" y1="7" x2="12" y2="7" />
                <line x1="2" y1="10.5" x2="12" y2="10.5" />
              </svg>
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
            initialRunnerConfig={parseRunnerConfig(block)}
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
