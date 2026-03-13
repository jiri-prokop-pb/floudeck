import type { BlockRecord } from "../../types.ts";
import { ErrorPanel } from "./ErrorPanel.tsx";

type BlockBodyProps = {
  block: BlockRecord;
};

export function BlockBody({ block }: BlockBodyProps) {
  if (block.status === "running") {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-zinc-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
        Running...
      </div>
    );
  }

  if (block.status === "error" && block.error_text) {
    return (
      <ErrorPanel errorText={block.error_text} lastRunAt={block.last_run_at} />
    );
  }

  if (block.status === "success" && block.output_html) {
    return (
      <div
        className="prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: block.output_html }}
      />
    );
  }

  if (block.status === "idle") {
    return (
      <p className="py-2 text-sm text-zinc-400">Waiting for first run...</p>
    );
  }

  return null;
}
