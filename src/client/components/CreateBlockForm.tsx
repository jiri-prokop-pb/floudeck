import { useState } from "react";
import type { BlockRecord } from "../../types.ts";
import { createBlockApi } from "../lib/api.ts";

type CreateBlockFormProps = {
  onCreate: (block: BlockRecord) => void;
};

export function CreateBlockForm({ onCreate }: CreateBlockFormProps) {
  const [prompt, setPrompt] = useState("");
  const [intervalValue, setIntervalValue] = useState(15);
  const [intervalUnit, setIntervalUnit] = useState("minutes");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!prompt.trim()) {
      setError("Prompt is required");
      return;
    }
    if (!Number.isInteger(intervalValue) || intervalValue <= 0) {
      setError("Interval must be a positive integer");
      return;
    }

    setLoading(true);
    const res = await createBlockApi({ prompt, intervalValue, intervalUnit });
    if (res.ok) {
      onCreate(res.block);
      setPrompt("");
      setIntervalValue(15);
      setIntervalUnit("minutes");
    } else {
      setError(res.error);
    }
    setLoading(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4"
    >
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="What should this block do?"
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
        rows={3}
      />
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-600">Every</span>
        <input
          type="number"
          min={1}
          value={intervalValue}
          onChange={(e) => setIntervalValue(Number(e.target.value))}
          className="w-20 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm focus:border-zinc-400 focus:outline-none"
        />
        <select
          value={intervalUnit}
          onChange={(e) => setIntervalUnit(e.target.value)}
          className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm focus:border-zinc-400 focus:outline-none"
        >
          <option value="minutes">minutes</option>
          <option value="hours">hours</option>
          <option value="days">days</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="ml-auto rounded-lg bg-zinc-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {loading ? "Adding..." : "Add block"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
