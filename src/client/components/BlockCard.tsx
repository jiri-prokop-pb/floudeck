import { useState } from "react";
import type { BlockRecord } from "../../types.ts";
import { formatSchedule, formatTimeAgo, formatTimeUntil } from "../lib/format.ts";
import { deleteBlockApi, refreshBlockApi, updateBlockApi } from "../lib/api.ts";
import { BlockBody } from "./BlockBody.tsx";

type BlockCardProps = {
  block: BlockRecord;
  onUpdate: (block: BlockRecord) => void;
  onDelete: (id: number) => void;
};

const statusColors: Record<string, string> = {
  idle: "bg-zinc-100 text-zinc-600",
  running: "bg-blue-100 text-blue-700",
  success: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
};

export function BlockCard({ block, onUpdate, onDelete }: BlockCardProps) {
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(block.prompt);
  const [intervalValue, setIntervalValue] = useState(block.interval_value);
  const [intervalUnit, setIntervalUnit] = useState(block.interval_unit);
  const [loading, setLoading] = useState(false);

  async function handleRefresh() {
    setLoading(true);
    const res = await refreshBlockApi(block.id);
    if (res.ok) onUpdate(res.block);
    setLoading(false);
  }

  async function handleDelete() {
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
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-700">
            {formatSchedule(block.interval_value, block.interval_unit)}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[block.status] ?? ""}`}
          >
            {block.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || block.status === "running"}
            className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setEditing(!editing)}
            className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="border-b border-zinc-100 bg-zinc-50 px-5 py-4 space-y-3">
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
              onChange={(e) => setIntervalUnit(e.target.value as "minutes" | "hours" | "days")}
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

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-2 text-xs text-zinc-400">
        <span>
          {block.last_run_at
            ? `Last run ${formatTimeAgo(block.last_run_at)}`
            : "Not yet run"}
        </span>
        <span>
          {block.status === "running"
            ? "Running now"
            : block.next_run_at
              ? `Next ${formatTimeUntil(block.next_run_at)}`
              : ""}
        </span>
      </div>
    </div>
  );
}
