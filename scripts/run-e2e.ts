import { getFreePort } from "./e2e-port.ts";

const port = await getFreePort();

const proc = Bun.spawn(["bun", "playwright", "test"], {
  env: {
    ...process.env,
    E2E_PORT: String(port),
  },
  stdout: "inherit",
  stderr: "inherit",
});

const exitCode = await proc.exited;
process.exit(exitCode);
