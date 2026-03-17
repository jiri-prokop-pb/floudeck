import type { BlockRecord } from "../../types.ts";
import { extractTitle, renderMarkdown } from "../lib/markdown.ts";
import { ErrorPanel } from "./ErrorPanel.tsx";

type BlockBodyProps = {
  block: BlockRecord;
};

function PulseSkeleton() {
  return (
    <div className="animate-pulse space-y-3 py-4">
      <div className="h-3 w-3/4 rounded bg-zinc-200" />
      <div className="h-3 w-1/2 rounded bg-zinc-200" />
      <div className="h-3 w-5/6 rounded bg-zinc-200" />
    </div>
  );
}

function MarkdownContent({ markdown }: { markdown: string }) {
  const { title, body } = extractTitle(markdown);
  return (
    <>
      <h2 className="text-lg font-semibold text-zinc-900 mb-2">{title}</h2>
      {body && (
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
        />
      )}
    </>
  );
}

export function BlockBody({ block }: BlockBodyProps) {
  if (block.status === "running") {
    if (block.output_markdown) {
      return <MarkdownContent markdown={block.output_markdown} />;
    }
    if (block.error_text) {
      return (
        <ErrorPanel
          errorText={block.error_text}
          lastRunAt={block.last_run_at}
        />
      );
    }
    return <PulseSkeleton />;
  }

  if (block.status === "error" && block.error_text) {
    return (
      <ErrorPanel errorText={block.error_text} lastRunAt={block.last_run_at} />
    );
  }

  if (block.status === "success" && block.output_markdown) {
    return <MarkdownContent markdown={block.output_markdown} />;
  }

  if (block.status === "idle") {
    return (
      <p className="py-2 text-sm text-zinc-400">Waiting for first run...</p>
    );
  }

  return null;
}
