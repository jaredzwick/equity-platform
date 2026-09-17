// runner.mjs — the generic AI-cron worker.
//
// Contract:
//   Input env:  PROMPT, TENANT, CRON_NAME, NATS_URL, CLAUDE_CODE_OAUTH_TOKEN,
//               optional MODEL (defaults to claude-sonnet-4-6).
//   Behavior:   spawns `claude --print --model <MODEL>` with PROMPT on stdin,
//               streams stdout to this container's stdout (k8s captures it),
//               publishes ONE JetStream event to events.<tenant>.cron.completed
//               with a truncated summary + exit code, then exits with
//               claude's exit code.
//
// Subject grammar note: `events.<tenant>.cron.completed` intentionally omits
// the .v<n> suffix used by the console's core event grammar (see
// console/lib/events/subject.ts). Cron completions are runtime signals, not
// versioned domain events. Consumers can still subscribe via any JetStream
// filter — see console/lib/events/consumer.ts.

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { connect, JSONCodec } from "nats";

const {
  PROMPT,
  TENANT,
  CRON_NAME,
  NATS_URL,
  MODEL = "claude-sonnet-4-6",
} = process.env;

// entrypoint.sh already validated these; guard here too so runner.mjs is
// safe to invoke directly during local testing.
for (const [k, v] of Object.entries({ PROMPT, TENANT, CRON_NAME, NATS_URL })) {
  if (!v) {
    console.error(`[claude-runner] ✗ missing required env: ${k}`);
    process.exit(2);
  }
}

// Truncate at ~8KB so a giant claude output doesn't blow past JetStream's
// default 1MB max-payload (leaves headroom for envelope overhead + any
// operator that tuned the stream lower).
const SUMMARY_MAX_BYTES = 8_000;

const started = new Date();
const runId = randomUUID();

console.error(
  `[claude-runner] starting cron=${CRON_NAME} tenant=${TENANT} model=${MODEL} runId=${runId}`,
);

const proc = spawn(
  "claude",
  ["--print", "--model", MODEL],
  {
    stdio: ["pipe", "pipe", "inherit"],
    env: process.env,
  },
);

proc.stdin.write(PROMPT);
proc.stdin.end();

let stdout = "";
proc.stdout.on("data", (chunk) => {
  // Stream to container stdout for `kubectl logs` visibility.
  process.stdout.write(chunk);
  // Buffer for the NATS payload — cap to SUMMARY_MAX_BYTES.
  if (stdout.length < SUMMARY_MAX_BYTES) {
    stdout += chunk.toString("utf8");
    if (stdout.length > SUMMARY_MAX_BYTES) {
      stdout = stdout.slice(0, SUMMARY_MAX_BYTES) + "\n[…truncated]";
    }
  }
});

const exitCode = await new Promise((resolve) => {
  proc.on("close", (code) => resolve(code ?? 0));
  proc.on("error", (err) => {
    console.error("[claude-runner] ✗ claude subprocess error:", err);
    resolve(127);
  });
});

const finished = new Date();
const durationMs = finished.getTime() - started.getTime();

console.error(
  `[claude-runner] cron=${CRON_NAME} exitCode=${exitCode} durationMs=${durationMs}`,
);

// Publish the completion event. Failure here MUST NOT mask claude's exit
// code — the log is captured by k8s regardless, but the operator loses the
// event-bus signal. We retry 3× with linear backoff then give up.
const subject = `events.${TENANT}.cron.completed`;
const envelope = {
  id: runId,
  tenant: TENANT,
  actor: { kind: "system", source: `cron/${CRON_NAME}` },
  source: `claude-runner:${CRON_NAME}`,
  correlationId: runId,
  ts: finished.toISOString(),
  // schemaVersion tracks the payload shape below. Bump on breaking changes;
  // the SUBJECT deliberately stays unversioned per D3.
  schemaVersion: 1,
  data: {
    cronName: CRON_NAME,
    model: MODEL,
    exitCode,
    startedAt: started.toISOString(),
    finishedAt: finished.toISOString(),
    durationMs,
    // Full prompt is echoed back so the event self-describes (correlation
    // when reacting to it doesn't require another read). Bound at ~2KB.
    prompt: PROMPT.length > 2000 ? PROMPT.slice(0, 2000) + "\n[…truncated]" : PROMPT,
    summary: stdout,
  },
};

const codec = JSONCodec();
let published = false;
for (let attempt = 1; attempt <= 3 && !published; attempt++) {
  try {
    const nc = await connect({ servers: NATS_URL, name: `claude-runner-${CRON_NAME}` });
    const js = nc.jetstream();
    await js.publish(subject, codec.encode(envelope), { msgID: envelope.id });
    console.error(`[claude-runner] ✓ published ${subject} (attempt ${attempt})`);
    await nc.drain();
    published = true;
  } catch (err) {
    console.error(
      `[claude-runner] ✗ NATS publish attempt ${attempt}/3 failed:`,
      err instanceof Error ? err.message : err,
    );
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, attempt * 500));
    }
  }
}

if (!published) {
  console.error(
    `[claude-runner] ✗ giving up on NATS publish after 3 attempts — event lost, stdout preserved in pod logs`,
  );
}

process.exit(exitCode);
