import { useRef, useState } from "react";
import type { BlockRecord } from "../../types.ts";
import { useClickOutside } from "../hooks/useClickOutside.ts";
import { deleteBlockApi, refreshBlockApi, updateBlockApi } from "../lib/api.ts";
import {
  formatSchedule,
  formatTimeAgo,
  formatTimeUntil,
} from "../lib/format.ts";
import { BlockBody } from "./BlockBody.tsx";

type BlockCardProps = {
  block: BlockRecord;
  onUpdate: (block: BlockRecord) => void;
  onDelete: (id: number) => void;
};

export function BlockCard({ block, onUpdate, onDelete }: BlockCardProps) {
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(block.prompt);
  const [intervalValue, setIntervalValue] = useState(block.interval_value);
  const [intervalUnit, setIntervalUnit] = useState(block.interval_unit);
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

  async function handleSave() {
    setLoading(true);
    const res = await updateBlockApi(block.id, {
      prompt,
      intervalValue,
      intervalUnit,
    });
    if (res.ok) {
      onUpdate(res.block);
      setEditing(false);
    }
    setLoading(false);
  }

  function handleCancel() {
    setPrompt(block.prompt);
    setIntervalValue(block.interval_value);
    setIntervalUnit(block.interval_unit);
    setEditing(false);
  }

  return (
    <div className="relative rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {/* Icon buttons */}
      <div className="absolute right-3 top-3 flex items-center gap-1 z-10">
        {/* Info button */}
        <div ref={infoRef} className="relative">
          <button
            type="button"
            onClick={() => setShowInfo(!showInfo)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 text-sm"
            title="Info"
          >
            ⓘ
          </button>
          {showInfo && (
            <div className="absolute right-0 top-8 w-56 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg text-xs text-zinc-600 space-y-1">
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
                    : "—"}
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
            ☰
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

      {/* Edit form */}
      {editing && (
        <div className="border-b border-zinc-100 bg-zinc-50 px-5 py-4 space-y-3 rounded-t-2xl">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
            rows={3}
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-600">Every</span>
            <input
              type="number"
              min={1}
              value={intervalValue}
              onChange={(e) => setIntervalValue(Number(e.target.value))}
              className="w-20 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm focus:border-zinc-400 focus:outline-none"
            />
            <select
              value={intervalUnit}
              onChange={(e) =>
                setIntervalUnit(e.target.value as "minutes" | "hours" | "days")
              }
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm focus:border-zinc-400 focus:outline-none"
            >
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
              <option value="days">days</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="px-5 py-4">
        <BlockBody block={block} />
      </div>
    </div>
  );
}
