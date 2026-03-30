import { CaretDown, Play } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { useClickOutside } from "../hooks/useClickOutside.ts";

export type TryMode = "try" | "debug";

type SplitTryButtonProps = {
  mode: TryMode;
  onModeChange: (mode: TryMode) => void;
  onRun: () => void;
  disabled?: boolean;
  running?: boolean;
};

export function SplitTryButton({
  mode,
  onModeChange,
  onRun,
  disabled,
  running,
}: SplitTryButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const label = mode === "debug" ? "Debug" : "Try";

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={onRun}
        disabled={disabled || running}
        className="inline-flex items-center gap-1 rounded-l-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
      >
        <Play size={14} weight="bold" />
        {running ? "Running..." : label}
      </button>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled || running}
        className="inline-flex items-center rounded-r-lg border border-l-0 border-zinc-200 px-1.5 py-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50"
      >
        <CaretDown size={12} weight="bold" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-32 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg z-20">
          <button
            type="button"
            onClick={() => {
              onModeChange("try");
              setOpen(false);
            }}
            className={`w-full px-3 py-1.5 text-left text-sm ${
              mode === "try"
                ? "font-medium text-zinc-900 bg-zinc-50"
                : "text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            Try
          </button>
          <button
            type="button"
            onClick={() => {
              onModeChange("debug");
              setOpen(false);
            }}
            className={`w-full px-3 py-1.5 text-left text-sm ${
              mode === "debug"
                ? "font-medium text-zinc-900 bg-zinc-50"
                : "text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            Debug
          </button>
        </div>
      )}
    </div>
  );
}
