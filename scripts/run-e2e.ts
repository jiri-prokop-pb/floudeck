const MIN_PORT = 40_000;
const PORT_RANGE = 20_000;
const MAX_ATTEMPTS = 5;

function choosePort(): number {
  return MIN_PORT + Math.floor(Math.random() * PORT_RANGE);
}

async function runPlaywright(port: number): Promise<{
  exitCode: number;
  combinedOutput: string;
}> {
  const proc = Bun.spawn(["bunx", "playwright", "test"], {
    env: {
      ...process.env,
      E2E_PORT: String(port),
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  return {
    exitCode,
    combinedOutput: `${stdout}\n${stderr}`,
  };
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  const port = choosePort();
  const { exitCode, combinedOutput } = await runPlaywright(port);

  if (exitCode === 0) {
    process.exit(0);
  }

  if (
    combinedOutput.includes("EADDRINUSE") &&
    attempt < MAX_ATTEMPTS
  ) {
    console.error(
      `e2e: port ${port} was unavailable, retrying (${attempt}/${MAX_ATTEMPTS})`,
    );
    continue;
  }

  process.exit(exitCode);
}

process.exit(1);
