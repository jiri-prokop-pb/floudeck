import { Bug, CaretRight } from "@phosphor-icons/react";
import { useState } from "react";
import type { DebugEvent } from "../../types.ts";

type DebugPanelProps = {
  events: DebugEvent[];
};

function CollapsibleContent({
  label,
  content,
}: {
  label: string;
  content: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-0.5 text-xs text-zinc-400 hover:text-zinc-600"
      >
        <CaretRight
          size={10}
          weight="bold"
          className={`transition-transform ${open ? "rotate-90" : ""}`}
        />
        {label}
      </button>
      {open && (
        <pre className="mt-1 max-h-40 overflow-auto rounded bg-zinc-100 p-2 text-xs text-zinc-600">
          {content}
        </pre>
      )}
    </div>
  );
}

function DebugEventItem({ event }: { event: DebugEvent }) {
  switch (event.kind) {
    case "tool_use":
      return (
        <div className="space-y-0.5">
          <span className="text-xs font-medium text-blue-600">
            Tool: {event.tool}
          </span>
          {event.input && (
            <CollapsibleContent label="Input" content={event.input} />
          )}
        </div>
      );
    case "tool_result":
      return (
        <div className="ml-3 space-y-0.5">
          <span className="text-xs text-zinc-500">Result</span>
          {event.output && (
            <CollapsibleContent label="Output" content={event.output} />
          )}
        </div>
      );
    case "thinking":
      return <p className="text-xs italic text-zinc-500">{event.text}</p>;
    case "system":
      return <p className="text-xs text-zinc-400">{event.message}</p>;
  }
}

export function DebugPanel({ events }: DebugPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (events.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50/50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-700"
      >
        <Bug size={14} weight="bold" />
        Debug ({events.length} events)
        <CaretRight
          size={10}
          weight="bold"
          className={`ml-auto transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>
      {expanded && (
        <div className="space-y-2 border-t border-zinc-200 px-3 py-2">
          {events.map((event, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: debug events have no stable id
            <DebugEventItem key={i} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
