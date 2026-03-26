type TauriInternals = {
  invoke(command: string): void;
};

function getTauriInternals(): TauriInternals | null {
  // biome-ignore lint/suspicious/noExplicitAny: window global augmentation requires runtime check
  const w = globalThis as any;
  const internals: unknown = w.__TAURI_INTERNALS__;
  if (
    internals &&
    typeof internals === "object" &&
    "invoke" in internals &&
    typeof internals.invoke === "function"
  ) {
    return { invoke: (cmd: string) => internals.invoke(cmd) };
  }
  return null;
}

export const isTauri = getTauriInternals() !== null;

export function startDrag(e: React.MouseEvent) {
  e.preventDefault();
  getTauriInternals()?.invoke("drag_window");
}

export function toggleMaximize() {
  getTauriInternals()?.invoke("toggle_maximize");
}
