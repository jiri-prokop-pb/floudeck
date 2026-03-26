type TauriInternals = {
  invoke(command: string): void;
};

function getTauriInternals(): TauriInternals | null {
  const w = window as Record<string, unknown>;
  if (
    "__TAURI_INTERNALS__" in w &&
    typeof w.__TAURI_INTERNALS__ === "object" &&
    w.__TAURI_INTERNALS__ !== null &&
    "invoke" in w.__TAURI_INTERNALS__
  ) {
    return w.__TAURI_INTERNALS__ as TauriInternals;
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
