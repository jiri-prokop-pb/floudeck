---
name: frontend-dev
description: Frontend development conventions — Tailwind v4, Bun HTML imports, icons, drag-and-drop, markdown rendering, client-side routing
---

# Frontend development conventions

## Tailwind v4

CSS uses v4 syntax — `@import "tailwindcss"` (not v3 `@tailwind` directives). Plugins via `@plugin`. CSS custom properties use `var(--color-zinc-200)` style tokens. `tailwindcss` must be a runtime dependency (not devDependency).

See `src/client/main.css`.

## Bun HTML imports

The server bundles the frontend via Bun's HTML import feature:

```ts
import homepage from "./client/index.html";
// in Bun.serve():
routes: {
  "/": homepage,
  "/action/*": homepage,  // wildcard for SPA client-side routes
  "/blocks/*": homepage,  // block create/edit pages
}
```

The HTML file references `./main.css` and `./app.tsx` — Bun resolves and bundles these at serve time. `development: true` enables HMR. Raw `Bun.file()` serving won't bundle TSX/CSS.

See `src/server.ts` and `src/client/index.html`.

## Icons — @phosphor-icons/react

All icons use `@phosphor-icons/react` with `weight="bold"`. No inline SVGs or Unicode icon characters.

```tsx
import { Info } from "@phosphor-icons/react";
<Info size={16} weight="bold" />
```

## Drag-and-drop — @dnd-kit

Using `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` for block reordering.

- `Feed.tsx`: wraps list in `<DndContext>` + `<SortableContext>` with `verticalListSortingStrategy`
- `BlockCard.tsx`: `SortableBlockCard` wraps `BlockCard` using `useSortable({ id: block.id })`
- Drag handle: `<button {...listeners}>` with `<DotsSixVertical>`, visible on `group-hover/sortable`
- `PointerSensor` with `activationConstraint: { distance: 5 }` to prevent accidental drags

**Position column**: `INTEGER NOT NULL DEFAULT 0` in SQLite. New blocks get `COALESCE(MAX(position), 0) + 1000`. On reorder, positions are reassigned as `(i + 1) * 1000` inside a transaction. `listBlocks` orders by `position ASC, created_at ASC`.

## Markdown — marked

Custom renderer in `src/client/lib/markdown.ts`.

- **HTML stripping**: `renderer.html = () => ""` — all raw HTML tokens become empty strings
- **Title extraction**: `extractTitle()` finds first `# Heading` line, removes it from body, returns `{ title, body }`

### Action link format

`[Label|color](/action/{block-uuid}/{action-name}?params)` — rendered as pastel-colored pill buttons with `data-action-link="true"`.

- Color tag parsed by splitting on last `|`, checked against `ACTION_COLORS` keys: `red`, `orange`, `yellow`, `green`, `blue`, `purple`
- Regular links with `|color` tag → colored underlined text with `target="_blank"`
- Regular links without color → standard `<a target="_blank" rel="noopener noreferrer">`
- Extension pattern: `marked.use({ renderer: { link(token) { ... } } })`

## React 19 patterns

### Data fetching — `use()` + Suspense

Replace `useEffect` + loading state with `use()` for async data:

```tsx
// Parent creates the promise (stable identity via useState)
function Parent() {
  const [dataPromise] = useState(() => fetchData());
  return (
    <ErrorBoundary fallback={<Error />}>
      <Suspense fallback={<Loading />}>
        <Child dataPromise={dataPromise} />
      </Suspense>
    </ErrorBoundary>
  );
}

// Child consumes via use() — suspends until resolved
function Child({ dataPromise }: { dataPromise: Promise<Data> }) {
  const data = use(dataPromise);
  return <div>{data.name}</div>;
}
```

**Key rule:** Create the promise in the **parent** component and pass it as a prop. Creating the promise with `useState` in the same component that calls `use()` causes an infinite render loop in Bun's dev bundler.

### Form submissions — `useActionState`

Replace manual `loading`/`error` state with `useActionState`:

```tsx
const [error, submitAction, isPending] = useActionState(
  async (_prev: string | null) => {
    // Read from controlled inputs in closure, not FormData
    const res = await saveData({ name, value });
    if (res.ok) { onSuccess(); return null; }
    return res.error;
  },
  null,
);

return (
  <form action={submitAction}>
    {error && <p className="text-red-600">{error}</p>}
    <button type="submit" disabled={isPending}>
      {isPending ? "Saving..." : "Save"}
    </button>
  </form>
);
```

### ErrorBoundary

`use()` throws on promise rejection — `Suspense` doesn't catch errors. Wrap Suspense in `<ErrorBoundary fallback={...}>` (class component in `ErrorBoundary.tsx`).

### What NOT to convert

- SSE listeners, event handlers (`useRouter`, `useSse`, `useClickOutside`)
- Timers (`HeaderClock`)
- Layout effects (scroll behavior)
- Side-effect buttons (e.g. "Try" button — stays as `onClick`)
- `ref` is a regular prop in React 19 — no `forwardRef` needed

## Client-side routing — useRouter

pushState-based SPA routing in `src/client/hooks/useRouter.ts`.

- Route type union: `{ page: "feed" }` | `{ page: "block-new" }` | `{ page: "block-edit"; blockId }` | `{ page: "action"; blockUuid; actionName; params }`
- `parseRoute` matches `/blocks/new`, `/blocks/(\d+)/edit`, `/action/([^/]+)/([^/?]+)` against `window.location.pathname`
- Navigation via click delegation: `document.addEventListener("click")` intercepts `a[data-action-link]` clicks, calls `pushState`
- `navigateHome()`, `navigateToNewBlock()`, `navigateToEditBlock(id)` push state and set route
- `popstate` listener handles browser back/forward
- Server registers `/action/*` and `/blocks/*` → `homepage` so direct URL loads work
