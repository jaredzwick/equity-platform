import "server-only";
import { connect, type NatsConnection } from "nats";

// Singleton NATS TCP connection.
//
// Cached on globalThis so Next.js dev HMR doesn't leak a new connection
// on every module reload (same pattern Prisma docs recommend). One conn
// per Node process; nats.js handles reconnect internally.

declare global {
  var __natsConn: Promise<NatsConnection> | undefined;
}

const NATS_URL = process.env.NATS_URL ?? "nats://localhost:4222";

export function getConn(): Promise<NatsConnection> {
  if (!globalThis.__natsConn) {
    globalThis.__natsConn = connect({
      servers: NATS_URL,
      reconnect: true,
      maxReconnectAttempts: -1,
      waitOnFirstConnect: false,
      name: "equity-console",
    }).catch((err) => {
      // Reset on initial connect failure so the next call retries.
      globalThis.__natsConn = undefined;
      throw err;
    });
  }
  return globalThis.__natsConn;
}
