import { useState } from "react";

type BlockFormData = {
  prompt: string;
  intervalValue: number;
  intervalUnit: string;
};

type BlockFormProps = {
  initialPrompt?: string;
  initialIntervalValue?: number;
  initialIntervalUnit?: string;
  submitLabel: string;
  onSubmit: (data: BlockFormData) => Promise<{ error?: string }>;
  onCancel?: () => void;
};

export function BlockForm({
  initialPrompt = "",
  initialIntervalValue = 15,
  initialIntervalUnit = "minutes",
  submitLabel,
  onSubmit,
  onCancel,
}: BlockFormProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [intervalValue, setIntervalValue] = useState(initialIntervalValue);
  const [intervalUnit, setIntervalUnit] = useState(initialIntervalUnit);
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
    const result = await onSubmit({ prompt, intervalValue, intervalUnit });
    if (result.error) {
      setError(result.error);
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="What should this block do?"
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
        rows={3}
      />
      <div className="flex items-center gap-2">
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
        <div className="ml-auto flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-zinc-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {loading ? "Saving..." : submitLabel}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
