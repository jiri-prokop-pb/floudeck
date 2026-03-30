import { Gear } from "@phosphor-icons/react";
import { Suspense, use, useCallback, useEffect, useState } from "react";
import type { BlockRecord, DisplaySettings } from "../../types.ts";
import { useBlocks } from "../hooks/useBlocks.ts";
import { useRouter } from "../hooks/useRouter.ts";
import { useSse } from "../hooks/useSse.ts";
import { fetchBlocks, fetchDisplaySettings } from "../lib/api.ts";
import { isTauri, startDrag, toggleMaximize } from "../lib/tauri.ts";
import { ActionPage } from "./ActionPage.tsx";
import { BlockFormPage } from "./BlockFormPage.tsx";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { Feed } from "./Feed.tsx";
import { HeaderClock } from "./HeaderClock.tsx";
import { SettingsPage } from "./SettingsPage.tsx";

export function App() {
  const [blocksPromise] = useState(() => fetchBlocks());
  const [displaySettingsPromise] = useState(() => fetchDisplaySettings());

  return (
    <ErrorBoundary
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50">
          <p className="text-sm text-red-600">
            Failed to load. Please refresh the page.
          </p>
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-zinc-50">
            <p className="text-sm text-zinc-400">Loading...</p>
          </div>
        }
      >
        <AppContent
          blocksPromise={blocksPromise}
          displaySettingsPromise={displaySettingsPromise}
        />
      </Suspense>
    </ErrorBoundary>
  );
}

function AppContent({
  blocksPromise,
  displaySettingsPromise,
}: {
  blocksPromise: Promise<BlockRecord[]>;
  displaySettingsPromise: Promise<DisplaySettings | null>;
}) {
  const {
    route,
    navigateHome,
    navigateToNewBlock,
    navigateToEditBlock,
    navigateToSettings,
  } = useRouter();
  const {
    blocks,
    refetchBlocks,
    refetchBlock,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleReorder,
    handleBlockStale,
    refreshStaleBlocks,
  } = useBlocks(blocksPromise);

  const initialDisplaySettings = use(displaySettingsPromise);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(
    initialDisplaySettings ?? {
      dateFormat: "D. M.",
      timeFormat: "24h",
      compactMode: false,
    },
  );

  const refetchDisplaySettings = useCallback(async () => {
    const settings = await fetchDisplaySettings();
    if (settings) {
      setDisplaySettings(settings);
    }
  }, []);

  useSse({
    onBlockUpdated: refetchBlock,
    onBlocksInvalidated: refetchBlocks,
  });

  // Refresh stale blocks when returning to feed
  useEffect(() => {
    if (route.page === "feed") {
      refreshStaleBlocks();
    }
  }, [route.page, refreshStaleBlocks]);

  const compact = displaySettings.compactMode === true;

  if (route.page === "action") {
    return (
      <ActionPage
        key={`${route.blockUuid}/${route.actionName}?${new URLSearchParams(route.params).toString()}`}
        blockUuid={route.blockUuid}
        actionName={route.actionName}
        params={route.params}
        onNavigateHome={navigateHome}
        onBlockStale={handleBlockStale}
      />
    );
  }

  if (route.page === "block-new") {
    return (
      <BlockFormPage
        compact={compact}
        onNavigateHome={navigateHome}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />
    );
  }

  if (route.page === "block-edit") {
    return (
      <BlockFormPage
        key={route.blockId}
        compact={compact}
        blockId={route.blockId}
        onNavigateHome={navigateHome}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />
    );
  }

  if (route.page === "settings") {
    return (
      <SettingsPage
        compact={compact}
        onNavigateHome={navigateHome}
        onDisplaySettingsChanged={refetchDisplaySettings}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {isTauri && (
        <div
          role="toolbar"
          aria-label="Window controls"
          onMouseDown={startDrag}
          onDoubleClick={toggleMaximize}
          className="fixed top-0 left-0 right-0 h-8 z-[60]"
          style={{ cursor: "default" }}
        />
      )}
      <div
        className={`mx-auto max-w-3xl px-4 ${compact ? "py-4" : "py-10"}`}
        style={
          isTauri ? { paddingTop: compact ? "1.5rem" : "2.5rem" } : undefined
        }
      >
        <header
          className={`flex items-center justify-between ${compact ? "mb-3" : "mb-8"}`}
        >
          <div className={`flex items-center ${compact ? "gap-2" : "gap-3"}`}>
            <img
              src="/logo.png"
              srcSet="/logo@2x.png 2x, /logo@3x.png 3x"
              alt=""
              className={`${compact ? "h-5" : "h-10"} w-auto`}
            />
            {compact ? (
              <div className="flex items-baseline gap-1.5">
                <h1 className="text-sm font-semibold text-zinc-900">
                  Floudeck
                </h1>
                <p className="text-xs text-zinc-400">
                  Your deck of signals and actions
                </p>
              </div>
            ) : (
              <div>
                <h1 className="text-2xl font-bold text-zinc-900">Floudeck</h1>
                <p className="text-sm text-zinc-500">
                  Your deck of signals and actions
                </p>
              </div>
            )}
          </div>
          <div
            className={`flex items-center gap-2 ${isTauri ? "relative z-[61]" : ""}`}
          >
            <HeaderClock displaySettings={displaySettings} compact={compact} />
            <button
              type="button"
              onClick={navigateToSettings}
              className={`flex items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 ${compact ? "h-6 w-6" : "h-8 w-8"}`}
              title="Settings"
            >
              <Gear size={compact ? 14 : 16} weight="bold" />
            </button>
          </div>
        </header>

        <Feed
          blocks={blocks}
          compact={compact}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onReorder={handleReorder}
          onEdit={navigateToEditBlock}
        />

        <button
          type="button"
          onClick={navigateToNewBlock}
          className={`w-full rounded-2xl border border-dashed border-zinc-300 text-sm font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 hover:bg-zinc-100/50 ${compact ? "mt-3 py-2" : "mt-6 py-3"}`}
        >
          + Add another block
        </button>
      </div>
    </div>
  );
}
