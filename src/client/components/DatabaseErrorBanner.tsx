import { ArrowCounterClockwise, Warning } from "@phosphor-icons/react";
import { useActionState, useState } from "react";
import type { DbBackupInfo } from "../lib/api.ts";
import { resetDatabaseApi, restoreDatabaseApi } from "../lib/api.ts";
import { Modal } from "./Modal.tsx";

type Props = {
  backups: DbBackupInfo[];
};

type ConfirmAction = { type: "reset" } | { type: "restore"; version: number };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DatabaseErrorBanner({ backups }: Props) {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );

  const [error, submitAction, isPending] = useActionState(
    async (_prev: string | null) => {
      if (!confirmAction) return null;
      const result =
        confirmAction.type === "reset"
          ? await resetDatabaseApi()
          : await restoreDatabaseApi(confirmAction.version);

      if (result.ok) {
        // Server is restarting — show message, SSE will reconnect
        setConfirmAction(null);
        return null;
      }
      return result.error;
    },
    null,
  );

  return (
    <>
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <Warning
            size={20}
            weight="bold"
            className="mt-0.5 shrink-0 text-amber-600"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-900">
              Database integrity issue detected
            </p>
            <p className="mt-1 text-xs text-amber-700">
              The database may be corrupted. You can restore from a backup or
              reset to a fresh database.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {backups.map((backup) => (
                <button
                  key={backup.path}
                  type="button"
                  onClick={() =>
                    setConfirmAction({
                      type: "restore",
                      version: backup.version,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-amber-800 shadow-sm ring-1 ring-amber-200 hover:bg-amber-100"
                >
                  <ArrowCounterClockwise size={14} weight="bold" />
                  Restore to v{backup.version}
                  <span className="text-amber-500">
                    ({formatBytes(backup.size)})
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setConfirmAction({ type: "reset" })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-red-700 shadow-sm ring-1 ring-red-200 hover:bg-red-50"
              >
                Reset database
              </button>
            </div>
          </div>
        </div>
      </div>

      {confirmAction && (
        <Modal
          title={
            confirmAction.type === "reset"
              ? "Reset Database"
              : `Restore to v${confirmAction.version}`
          }
          onClose={() => setConfirmAction(null)}
        >
          <p className="text-sm text-zinc-600">
            {confirmAction.type === "reset"
              ? "This will delete all data and create a fresh database. A backup of the current database will be created first. The server will restart."
              : `This will replace the current database with the backup from version ${confirmAction.version}. A backup of the current database will be created first. The server will restart.`}
          </p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <form action={submitAction} className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmAction(null)}
              disabled={isPending}
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white ${
                confirmAction.type === "reset"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-amber-600 hover:bg-amber-700"
              } disabled:opacity-50`}
            >
              {isPending
                ? "Restarting..."
                : confirmAction.type === "reset"
                  ? "Reset"
                  : "Restore"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
