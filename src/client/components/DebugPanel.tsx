import {
  CaretRight,
  CircleNotch,
  Gear,
  Lightning,
  Terminal,
} from "@phosphor-icons/react";
import { useState } from "react";
import type { DebugEvent } from "../../types.ts";

type DebugPanelProps = {
  events: DebugEvent[];
  isStreaming?: boolean;
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
        className="inline-flex items-center gap-0.5 text-[11px] text-zinc-400 hover:text-zinc-300"
      >
        <CaretRight
          size={9}
          weight="bold"
          className={`transition-transform ${open ? "rotate-90" : ""}`}
        />
        {label}
      </button>
      {open && (
        <pre className="mt-1 max-h-40 overflow-auto rounded bg-zinc-900 p-2 text-[11px] text-zinc-400 border border-zinc-700">
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
        <div className="flex items-start gap-2">
          <Terminal
            size={12}
            weight="bold"
            className="mt-0.5 shrink-0 text-amber-400"
          />
          <div className="min-w-0 space-y-0.5">
            <span className="text-[11px] font-mono text-amber-300">
              {event.tool}
            </span>
            {event.input && (
              <CollapsibleContent label="input" content={event.input} />
            )}
          </div>
        </div>
      );
    case "tool_result":
      return (
        <div className="flex items-start gap-2 ml-4">
          <Lightning
            size={12}
            weight="bold"
            className="mt-0.5 shrink-0 text-green-400"
          />
          <div className="min-w-0 space-y-0.5">
            <span className="text-[11px] text-green-300">result</span>
            {event.output && (
              <CollapsibleContent label="output" content={event.output} />
            )}
          </div>
        </div>
      );
    case "thinking":
      return (
        <p className="text-[11px] leading-relaxed text-zinc-400 pl-5">
          {event.text}
        </p>
      );
    case "system":
      return (
        <div className="flex items-start gap-2">
          <Gear
            size={12}
            weight="bold"
            className="mt-0.5 shrink-0 text-zinc-500"
          />
          <p className="text-[11px] text-zinc-500">{event.message}</p>
        </div>
      );
  }
}

export function DebugPanel({ events, isStreaming }: DebugPanelProps) {
  if (events.length === 0) return null;

  return (
    <div className="rounded-lg bg-zinc-800 border border-zinc-700 font-mono overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-zinc-700 bg-zinc-800/80">
        {isStreaming ? (
          <CircleNotch
            size={11}
            weight="bold"
            className="text-amber-400 animate-spin"
          />
        ) : (
          <Terminal size={11} weight="bold" className="text-zinc-500" />
        )}
        <span className="text-[11px] font-medium text-zinc-500">
          trace
          <span className="ml-1 text-zinc-600">({events.length})</span>
        </span>
      </div>
      <div className="space-y-1.5 px-3 py-2 max-h-64 overflow-y-auto">
        {events.map((event, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: debug events have no stable id
          <DebugEventItem key={i} event={event} />
        ))}
      </div>
    </div>
  );
}
