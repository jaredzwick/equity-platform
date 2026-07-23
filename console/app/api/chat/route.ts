// POST /api/chat — spawn `claude --print` and stream stdout to the browser.
//
// Auth: uses CLAUDE_CODE_OAUTH_TOKEN from .env.local (Claude Code Max
// subscription). ANTHROPIC_API_KEY is explicitly emptied so the CLI takes
// the OAuth path — never the paid-API path.
//
// Runtime: nodejs (child_process not available on edge). Marked below.

import { spawn } from "node:child_process";
import { NextRequest } from "next/server";
import { buildBusinessContext } from "@/lib/business-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ChatMsg = { role: "user" | "assistant"; content: string };
type Body = { tenant: string; messages: ChatMsg[] };

// TODO: tighten tool restrictions once we verify the exact --disallowed-tools
// flag name for this Claude Code version. For now, defaults apply; the system
// prompt frames the assistant as read-only Q&A about cluster state.

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response("invalid JSON", { status: 400 });
  }
  if (!body.tenant || !Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response("missing tenant or messages", { status: 400 });
  }

  // Fresh cluster snapshot every turn — the whole point of the chat is that
  // the model sees live state, not a stale system prompt.
  const contextBlurb = await buildBusinessContext(body.tenant);
  const systemPrompt =
    `You are the equity-console assistant for the "${body.tenant}" business.\n\n` +
    `Answer questions about this business's Kubernetes infrastructure using the\n` +
    `LIVE STATE below. Be tight, specific, and cite exact names/namespaces.\n` +
    `If asked something the context doesn't cover, say so plainly — do not\n` +
    `invent app names or health statuses.\n\n` +
    `--- LIVE STATE ---\n${contextBlurb}\n--- END LIVE STATE ---`;

  // Multi-turn: pass the full conversation as one text prompt. Simpler than
  // subprocess session persistence and lets us stay stateless server-side.
  // The latest user message goes on its own so the model has a clear ask.
  const latest = body.messages[body.messages.length - 1];
  if (latest.role !== "user") {
    return new Response("last message must be role=user", { status: 400 });
  }
  const historyText = body.messages
    .slice(0, -1)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
  const promptArg = historyText
    ? `Prior conversation:\n${historyText}\n\nLatest user turn:\n${latest.content}`
    : latest.content;

  const proc = spawn(
    "claude",
    [
      "--print",
      "--model", "claude-opus-4-7",
      "--append-system-prompt", systemPrompt,
      // Piping the prompt via stdin avoids positional-arg conflicts with
      // multi-word flag values like --append-system-prompt.
    ],
    {
      env: {
        ...process.env,
        // Force OAuth path — empty out any inherited API key.
        ANTHROPIC_API_KEY: "",
      },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  proc.stdin.write(promptArg);
  proc.stdin.end();

  let stderrBuf = "";
  proc.stderr.on("data", (chunk: Buffer) => {
    const s = chunk.toString();
    stderrBuf += s;
    console.error("[claude stderr]", s);
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
