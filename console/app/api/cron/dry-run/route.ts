// POST /api/cron/dry-run
//
// Runs a proposed cron prompt through `claude --print` right now — no
// container spawn, no k8s CronJob, no git commit. Streams stdout back so
// the operator can iterate on the prompt before shipping it.
//
// Two intentional differences from the real runner:
//   1. Executes on the console's Node process, not inside the
//      equity/claude-runner container. Fast (no image pull, no pod
//      schedule). Doesn't validate the k8s path.
//   2. Passes NO MCP config → the model has ZERO tools. Pure
//      prompt→text test. Prevents an "audit gsc" dry-run from
//      accidentally mutating anything via a stray MCP tool.
//
// Body: { prompt: string, model?: string }
//   prompt is required; extracted client-side from the assistant's
//   proposed YAML block via console/lib/cron-proposal.ts.
//
// Response: text/plain streamed. Non-2xx status = validation error.

import { spawn } from "node:child_process";
import { NextRequest } from "next/server";
import { MCP_CONFIG_EMPTY } from "@/lib/mcp-configs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Same allow-list as /api/chat. Keep in sync.
const ALLOWED_MODELS = new Set([
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
]);
const DEFAULT_MODEL = "claude-sonnet-4-6";

// Cap so a runaway prompt can't hang forever + can't blow up token spend.
const MAX_PROMPT_BYTES = 32_000;

type Body = { prompt: string; model?: string };

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response("invalid JSON", { status: 400 });
  }
  if (typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
    return new Response("prompt is required", { status: 400 });
  }
  if (body.prompt.length > MAX_PROMPT_BYTES) {
    return new Response(`prompt too large (>${MAX_PROMPT_BYTES} bytes)`, { status: 413 });
  }

  const requested = typeof body.model === "string" ? body.model : undefined;
  const model = requested && ALLOWED_MODELS.has(requested) ? requested : DEFAULT_MODEL;

  const proc = spawn(
    "claude",
    [
      "--print",
      "--model", model,
      // Explicitly empty MCP config: dry-runs must be side-effect-free.
      // The value MUST include an mcpServers key even when empty —
      // `{}` alone fails the CLI's schema validation with:
      //   "mcpServers: Does not adhere to MCP server configuration schema"
      // The constant + validator in @/lib/mcp-configs is the source of
      // truth; a lint test guards against drift.
      "--mcp-config", MCP_CONFIG_EMPTY,
      "--strict-mcp-config",
    ],
    {
      env: {
        ...process.env,
        // Force OAuth path — mirror the guard in /api/chat.
        ANTHROPIC_API_KEY: "",
      },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  proc.stdin.write(body.prompt);
  proc.stdin.end();

  let stderrBuf = "";
  proc.stderr.on("data", (chunk: Buffer) => {
    const s = chunk.toString();
    stderrBuf += s;
    console.error("[dry-run stderr]", s);
  });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      proc.stdout.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });
      proc.on("close", (code) => {
        if (code !== 0) {
          const err = `\n\n[claude exited ${code}] ${stderrBuf.slice(0, 500)}`;
          controller.enqueue(new TextEncoder().encode(err));
        }
        controller.close();
      });
      proc.on("error", (err) => {
        controller.error(err);
      });
    },
    cancel() {
      proc.kill("SIGTERM");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
