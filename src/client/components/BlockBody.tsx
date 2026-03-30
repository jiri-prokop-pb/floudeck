import type { BlockRecord } from "../../types.ts";
import { extractTitle, renderMarkdown } from "../lib/markdown.ts";
import { ErrorPanel } from "./ErrorPanel.tsx";
import { PulseSkeleton } from "./PulseSkeleton.tsx";

type BlockBodyProps = {
  block: BlockRecord;
  compact?: boolean;
};

function MarkdownContent({
  markdown,
  compact,
}: {
  markdown: string;
  compact?: boolean;
}) {
  const { title, body } = extractTitle(markdown);
  return (
    <>
      <h2
        className={`font-semibold text-zinc-900 ${compact ? "text-base mb-1" : "text-lg mb-2"}`}
      >
        {title}
      </h2>
      {body && (
        <div
          className={`prose prose-sm max-w-none ${compact ? "prose-compact" : ""}`}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
        />
      )}
    </>
  );
}

export function BlockBody({ block, compact }: BlockBodyProps) {
  if (block.status === "running") {
    if (block.output_markdown) {
      return (
        <MarkdownContent markdown={block.output_markdown} compact={compact} />
      );
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
    return (
      <MarkdownContent markdown={block.output_markdown} compact={compact} />
    );
  }

  if (block.status === "idle") {
    return (
      <p className="py-2 text-sm text-zinc-400">Waiting for first run...</p>
    );
  }

  return null;
}
