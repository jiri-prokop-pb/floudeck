export type SseBroadcaster = {
  addClient(): Response;
  broadcast(event: string, data: unknown): void;
  clientCount(): number;
  close(): void;
};

type Client = {
  controller: ReadableStreamDefaultController<Uint8Array>;
  closed: boolean;
};

export function createSseBroadcaster(): SseBroadcaster {
  const clients = new Set<Client>();
  let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  const encoder = new TextEncoder();

  function startKeepalive() {
    if (keepaliveTimer) return;
    keepaliveTimer = setInterval(() => {
      const msg = encoder.encode(": keepalive\n\n");
      for (const client of clients) {
        try {
          client.controller.enqueue(msg);
        } catch {
          client.closed = true;
          clients.delete(client);
        }
      }
    }, 20_000);
  }

  function addClient(): Response {
    startKeepalive();
    let client: Client;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        client = { controller, closed: false };
        clients.add(client);
      },
      cancel() {
        if (client) {
          client.closed = true;
          clients.delete(client);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  function broadcast(event: string, data: unknown): void {
    const frame = encoder.encode(
      `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
    );
    for (const client of clients) {
      try {
        client.controller.enqueue(frame);
      } catch {
        client.closed = true;
        clients.delete(client);
      }
    }
  }

  function clientCount(): number {
    return clients.size;
  }

  function close(): void {
    if (keepaliveTimer) {
      clearInterval(keepaliveTimer);
      keepaliveTimer = null;
    }
    for (const client of clients) {
      try {
        client.controller.close();
      } catch {
        // ignore
      }
      client.closed = true;
    }
    clients.clear();
  }

  return { addClient, broadcast, clientCount, close };
}
