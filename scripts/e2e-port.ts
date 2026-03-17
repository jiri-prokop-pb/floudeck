import { createServer } from "node:net";

/** Bind to port 0 to let the OS assign a free port, then release it. */
export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

/** Read and validate E2E_PORT from the environment. */
export function parseE2ePort(): number {
  const raw = process.env.E2E_PORT;
  if (!raw)
    throw new Error("E2E_PORT is required. Run the suite via `bun run e2e`.");
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0)
    throw new Error(`Invalid E2E_PORT: ${raw}`);
  return port;
}
