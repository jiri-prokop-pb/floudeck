---
name: workflows
description: Step-by-step checklists for common multi-file changes — new API endpoint, DB column, block feature, UI component, scheduler behavior
---

# Development workflows

Checklists for multi-file changes. Follow the order listed — later steps depend on earlier ones.

## Adding a new API endpoint

1. **`src/api.ts`** — Add a route entry to the `routes` array inside `createRouter`:
   ```ts
   { method: "POST", pattern: "/api/thing/:id/action", handler: async (req, params) => { ... } }
   ```
   Use the provided helpers: `parseJsonBody`, `requireJsonObject`, `requireBlockId`, `json(data, status?)`. For new body schemas, define a `z.object(...)` const at module scope and use `.safeParse()`. Router returns `null` for unmatched routes — no server.ts changes needed.

2. **`src/client/lib/api.ts`** — Add a typed wrapper using `apiFetch<T>(path, options?)`:
   ```ts
   export async function myActionApi(id: number, input: Input): Promise<ApiResponse<{ thing: Thing }>> {
     return apiFetch(`/api/thing/${id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
   }
   ```

3. **`src/api.test.ts`** — Test the route by passing `Request` objects directly to the router. Use `req(method, path, body?)` and `jsonBody(res)` helpers. Test both happy path and error cases (missing ID, bad input, 404).

4. **`src/server.ts`** — Only change if adding a new SPA HTML route (e.g. `/newpath/*` → `homepage`). Regular API routes need no server.ts changes.

## Adding a DB column or table

1. **`src/db.ts`** — Modify `CREATE TABLE` in `initDb()`. For existing tables, add nullable/defaulted columns (SQLite won't auto-add to existing DBs without ALTER). Add query functions taking `Database` as first param.

2. **`src/types.ts`** — Add the column to the record type (e.g. `BlockRecord`). For new JSON-column types, define a zod schema + inferred type.

3. **`src/validate.ts`** — Add `safeParse*` function for new JSON columns, or input validation for new POST body shapes.

4. **`src/db.test.ts`** — Test CRUD operations with `:memory:` DB. Use `mustGet*` helpers with runtime guards instead of `!`.

5. **Update API/client/UI** as needed (see other workflows).

**No migration system exists.** New columns must be backward-compatible (nullable or defaulted). Dev databases may need to be wiped for breaking schema changes.

## Adding a new block feature (full vertical)

Follow this order — types → db → backend logic → server wiring → client API → client UI → routing:

1. **`src/types.ts`** — New types and zod schemas
2. **`src/db.ts`** — New table/columns in `initDb()`, CRUD functions
3. **`src/prompts.ts`** — New system prompts if the feature involves Claude runs
4. **`src/validate.ts`** — Input validation (or inline zod schema in api.ts if used in one place only)
5. **`src/api.ts`** — New routes. Add deps to `RouterDeps` if needed
6. **`src/server.ts`** — Wire new deps into `createApp`/`AppOptions`. Add HTML routes for new SPA paths
7. **`src/scheduler.ts`** — If the feature needs periodic work (cleanup, etc.)
8. **`src/client/lib/api.ts`** — Client fetch wrappers
9. **`src/client/components/`** — New or modified components
10. **`src/client/hooks/`** — New hooks or SSE event handlers
11. **`src/client/lib/markdown.ts`** — If the feature adds new markdown rendering behavior
12. **Tests** — Unit tests for each layer, E2E for user-facing flows
13. **Docs** — Update SPEC.md, README.md, CLAUDE.md, TODO.md as needed

## Adding a new UI component

1. **`src/client/components/MyComponent.tsx`** — Props typed inline (data + callbacks, no raw state drilling). Tailwind inline, phosphor icons with `weight="bold"`.

2. **`src/client/lib/api.ts`** — Add typed wrappers if new API calls needed. Call wrapper, check `.ok`, invoke callback.

3. **Parent component** — Render the new component, pass data + callbacks.

4. **SSE integration** — SSE is wired at the App level via `useSse`. Components receive updated props automatically via state in `App.tsx`. Don't subscribe to SSE in individual components (exception: isolated pages like `ActionPage` that manage their own lifecycle). To add a new SSE event type:
   - Add to `SseCallbacks` type and `useEffect` body in `useSse`
   - Pass a new callback from `App.tsx`

## Modifying the scheduler

1. **`src/scheduler.ts`** — `tick()` is the single entry point. For per-tick logic, add directly. For periodic work, add a `maybeSomething()` function with its own interval guard:
   ```ts
   let lastMyThing = 0;
   const MY_INTERVAL_MS = 5 * 60 * 1000;
   function maybeDoMyThing(): void {
     const now = Date.now();
     if (now - lastMyThing < MY_INTERVAL_MS) return;
     lastMyThing = now;
     // do work
   }
   ```
   If you need new deps, add them to `SchedulerDeps` and destructure in `createScheduler`.

2. **`src/scheduler.test.ts`** — Call `await scheduler.tick()` directly. Use `createMockRunner(fn)` for the runner. Intercept SSE broadcasts by wrapping `sse.broadcast`. Manipulate DB timestamps to test periodic behavior.
