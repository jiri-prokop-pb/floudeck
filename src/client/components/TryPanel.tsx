import { extractTitle, renderMarkdown } from "../lib/markdown.ts";
import { PulseSkeleton } from "./PulseSkeleton.tsx";

export type TryState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; markdown: string }
  | { status: "error"; error: string };

type TryPanelProps = {
  state: TryState;
};

export function TryPanel({ state }: TryPanelProps) {
  if (state.status === "idle") return null;

  if (state.status === "running") {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
        <PulseSkeleton />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-600">{state.error}</p>
      </div>
    );
  }

  const { title, body } = extractTitle(state.markdown);
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      {title && (
        <h3 className="mb-2 text-base font-semibold text-zinc-900">{title}</h3>
      )}
      {body && (
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
        />
      )}
    </div>
  );
}
