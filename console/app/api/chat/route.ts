// POST /api/chat — spawn `claude --print` and stream stdout to the browser.
//
// Auth: uses CLAUDE_CODE_OAUTH_TOKEN from .env.local (Claude Code Max
// subscription). ANTHROPIC_API_KEY is explicitly emptied so the CLI takes
// the OAuth path — never the paid-API path.
//
// Runtime: nodejs (child_process not available on edge). Marked below.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { buildBusinessContext } from "@/lib/business-context";
import { resolveTargetRepo } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Primer for the events primitive. Appended to every chat system prompt so
// the assistant can scaffold event-driven reactions on request. Keep this
// short — every extra line goes into every turn's token bill. Keep it
// verbatim-accurate: consumers of the primer paste generated code, so
// wrong imports or signatures here become bugs there.
//
// Source of truth for the actual code: console/lib/events/*.ts + README.md.
// If you edit this primer, update the README (or vice versa).
const EVENTS_PRIMER = `--- EVENTS PRIMITIVE (for scaffolding reactions) ---

Subject grammar: events.<tenant>.<domain>.<entity>.<action>.v<n>
Example: events.pypes.listing.deal.created.v1

Every event carries this envelope:
  { id, tenant, actor, source, correlationId, ts, schemaVersion, data }

Three main entry points (import from "@/lib/events"):

1) publishEvent<T>({ subject: SubjectParts, data: T, actor: Actor, source: string, correlationId?: string })
   -> Promise<{ subject, seq, envelope }>. Ensures the tenant stream, dedups on envelope.id.

2) consume<T>({ name: string, tenant: string, filterSubject: string,
                handler: (env: Envelope<T>) => Promise<void>, maxDeliver?: number })
   -> Promise<() => Promise<void>>. Idempotent durable consumer. Handler MUST be idempotent.
   Throw = nack (redeliver up to maxDeliver, default 5).

3) registerEnrich<TIn, TOut>({ name, tenant, filterSubject,
                                budget?: { currency: "tokens" | "usd_micros", perDay: number },
                                handler: (env) => EnrichResult<TOut> | null })
   -> Promise<() => Promise<void>>. The enrich reaction pattern.
   EnrichResult = { outputSubject: SubjectParts, data: TOut, cost?: number }.
   Preserves correlationId onto the output event. Charges the budget by cost.
   Return null to skip publishing.

When the user asks you to "build a reaction", "scaffold X", "add a consumer",
or similar: emit a complete, compilable TypeScript code block using one of
these three functions. Fill filterSubject with a subject you actually saw in
the LIVE STATE above (or say so explicitly if you're inventing it).

Do NOT invent additional exports (no registerRoute/registerDraft/registerAct
yet — only registerEnrich ships today; the others follow the same shape).

Do NOT emit shell commands to write files. Return code the user pastes.
--- END EVENTS PRIMITIVE ---`;

// Primer for the cron primitive. Appended to every chat system prompt so
// the assistant can schedule AI-run cron jobs via the MCP tool.
// Consumers: `create_cron` in console/mcp/server.ts. If you change the
// tool schema, update this primer AND the console/mcp/README.md example.
const CRON_PRIMER = `--- CRON PRIMITIVE (for scheduling AI work on a schedule) ---

Tool: create_cron  (from the equity MCP server, loaded via .mcp.json)

Two calling shapes:
  1) Runner mode — { tenant, name, schedule, prompt }
     Runs equity/claude-runner:latest on the schedule. The container spawns
     \`claude --print $PROMPT\` inside a pod, streams stdout to k8s logs,
     and publishes ONE JetStream event to events.<tenant>.cron.completed
     on finish (envelope: { id, tenant, actor, source, ts, schemaVersion:1,
     data: { cronName, model, exitCode, durationMs, prompt, summary } }).
     Concurrency defaults to Forbid (LLM runs are expensive; skip overlaps).
  2) Shell mode — { tenant, name, schedule, image, command }
     Runs the given image with /bin/sh -c '<command>'. For non-AI crons.

Schedule inference examples:
  "weekly"                → "0 0 * * 0"
  "every Monday at 9am"   → "0 9 * * 1"
  "daily"                 → "0 0 * * *"
  "every hour"            → "0 * * * *"
  "every 5 minutes"       → "*/5 * * * *"

Name inference: kebab-case, ≤52 chars, derived from the intent
(e.g. "weekly gsc audit" → "weekly-gsc-audit").

Namespace defaults to the tenant's first known namespace — omit \`namespace\`
unless the operator specifies one.

MANDATORY WORKFLOW when the operator asks to schedule anything:

  Step 1: Propose the full YAML in a \`\`\`yaml … \`\`\` fenced code block.
          The console's chat UI parses that block to render "▶ Play" and
          "✅ Commit + apply" buttons under your message, so the shape
          matters — include at minimum:
            name: <kebab-case>
            schedule: "<5-field cron expression>"
            namespace: <k8s namespace>
            concurrencyPolicy: <Allow|Forbid|Replace>   (optional; runner defaults to Forbid)
          For runner mode also include:
            image: equity/claude-runner:latest
            prompt: |
              <the natural-language instruction, dedent 2 spaces>
          For shell mode instead:
            image: <docker image>
            command: <shell command>
          Explain what will happen on each run in one sentence beneath the block.
  Step 2: Mention the operator's options — they can either click ▶ Play to
          run the prompt against Claude right now with zero side effects
          (no cluster, no commit), or ✅ Commit + apply to schedule for
          real. Or type a tweak like "make it daily instead" to refine
          before either.
  Step 3: When (and only when) the operator says "commit", "commit + apply",
          or an equivalent explicit confirmation, call create_cron.
  Step 4: Report the tool's return text verbatim so the operator sees the
          git path + confirmation.

If the operator asks to tweak the proposal ("make it daily instead", "call
it foo instead"), update the YAML in-line and re-ask. Do NOT call
create_cron until the operator explicitly confirms.

Runner-mode pre-flight: create_cron will fail with a clear message if the
claude-runner-auth Secret is missing in the target namespace. Surface that
message directly — do not paper over it. The operator fixes it by running
\`make runner-secret NS=<tenant-namespace>\` from the repo root.
--- END CRON PRIMITIVE ---`;

type ChatMsg = { role: "user" | "assistant"; content: string };
type Body = { tenant: string; messages: ChatMsg[]; model?: string };

// Keep in sync with console/components/ModelPicker.tsx CHAT_MODELS.
const ALLOWED_MODELS = new Set([
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
]);
// Default lands on Sonnet — 3-5x faster TTFT than Opus for the fleet-status
// Q&A the deck is optimised for. Operators can flip to Opus via the picker
// (persisted per browser). Override the default globally via CHAT_MODEL.
const DEFAULT_MODEL =
  process.env.CHAT_MODEL && ALLOWED_MODELS.has(process.env.CHAT_MODEL)
    ? process.env.CHAT_MODEL
    : "claude-sonnet-4-6";

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
  const isAgency = body.tenant === "master";

  // The copilot layer sits ABOVE the infra layer in every conversation so
  // the model treats business-strategy questions as first-class, not as
  // out-of-domain "I only know Kubernetes" refusals. Ordering matters: the
  // model reads top-to-bottom and picks the first frame that matches. The
  // infra layer stays authoritative for anything grounded in LIVE STATE.
  const COPILOT_LAYER =
    `You operate in two roles for every question. Pick the right one based\n` +
    `on the operator's intent — don't announce which role you're in, just\n` +
    `answer well:\n\n` +
    `  1) BUSINESS COPILOT — strategy, positioning, marketing, sales,\n` +
    `     customer discovery, competitive analysis, pricing, product\n` +
    `     ideation, GTM. Draw on general business knowledge. Be concrete\n` +
    `     and specific: name real tactics, sample copy, real playbooks,\n` +
    `     real segments. When the operator hasn't told you enough about\n` +
    `     the business to be non-generic, ASK ONE sharp follow-up before\n` +
    `     answering (never a checklist of questions).\n\n` +
    `  2) INFRA ASSISTANT — Kubernetes apps, cron jobs, NATS event bus.\n` +
    `     Use ONLY the LIVE STATE block. Cite exact names, namespaces,\n` +
    `     subjects, counts. Never invent apps, health statuses, or event\n` +
    `     subjects that aren't in the state block.\n\n` +
    `If a question spans both (e.g., "which customer segment is at risk\n` +
    `if the daily digest cron has been stale for a week?"), use both layers\n` +
    `and mark the sections clearly in your reply.\n\n` +
    `Voice: builder-to-builder. Concrete nouns, active voice, short\n` +
    `paragraphs. No filler, no hedging, no permission-asking. Answer.`;

  const systemPrompt = isAgency
    ? `You are the equity-console agency copilot. You operate across ALL\n` +
      `businesses in this workspace. When asked about strategy, pattern,\n` +
      `or expansion across the portfolio, respond as a copilot. When asked\n` +
      `about fleet health or cross-business infra, cite the LIVE STATE.\n` +
      `To onboard a new business, prompt the operator through it inline.\n\n` +
      `${COPILOT_LAYER}\n\n` +
      `--- LIVE STATE ---\n${contextBlurb}\n--- END LIVE STATE ---\n\n` +
      `${EVENTS_PRIMER}\n\n` +
      `${CRON_PRIMER}`
    : `You are the equity-console business copilot for "${body.tenant}".\n` +
      `You are this operator's second brain for running the business AND\n` +
      `the person keeping tabs on its infrastructure. Both roles matter.\n\n` +
      `${COPILOT_LAYER}\n\n` +
      `--- LIVE STATE ---\n${contextBlurb}\n--- END LIVE STATE ---\n\n` +
      `${EVENTS_PRIMER}\n\n` +
      `${CRON_PRIMER}`;

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

  const requested = typeof body.model === "string" ? body.model : undefined;
  const model = requested && ALLOWED_MODELS.has(requested) ? requested : DEFAULT_MODEL;

  // Locate the repo-root .mcp.json (registers the equity MCP server with
  // create_business / create_cron / etc). process.cwd() when Next.js runs
  // via `npm run dev` is the console/ directory, so we look one up. If the
  // file's missing (rare — this repo has one committed), pass no flag and
  // claude falls back to CWD auto-discovery.
  const REPO_ROOT = path.resolve(process.cwd(), "..");
  const MCP_CONFIG_PATH = path.join(REPO_ROOT, ".mcp.json");
  const args = [
    "--print",
    "--model", model,
    "--append-system-prompt", systemPrompt,
    // Piping the prompt via stdin avoids positional-arg conflicts with
    // multi-word flag values like --append-system-prompt.
  ];
  if (existsSync(MCP_CONFIG_PATH)) {
    // --mcp-config takes an explicit path so we don't rely on the
    // subprocess's CWD guess. --strict-mcp-config prevents claude from
    // silently merging in the operator's own ~/.claude configs (e.g.
    // Notion, Gamma) — the chat should only see equity-platform tools.
    args.push("--mcp-config", MCP_CONFIG_PATH, "--strict-mcp-config");

    // Pre-approve the equity MCP tools so they can be called from the
    // non-interactive `claude --print` subprocess. Without this, claude
    // treats every tool call as needing OS-level permission approval,
    // and there's no UI to show that prompt in — the model just sees a
    // "blocked" error. Safety is enforced two layers up: (1) CRON_PRIMER
    // above mandates YAML preview + explicit user confirmation before
    // the model calls create_cron, and (2) the equity MCP server
    // itself validates every input + refuses master-slug / duplicate
    // names / missing GitHub config. This flag only opens the OS
    // permission gate, not the semantic one.
    args.push(
      "--allowedTools",
      [
        "mcp__equity__list_businesses",
        "mcp__equity__get_business",
        "mcp__equity__create_business",
        "mcp__equity__update_profile",
        "mcp__equity__create_cron",
      ].join(","),
    );
  }

  // Force GITHUB_REPO in the spawn env to whatever the console has resolved
  // as the correct write target (local/.config.json first, session second,
  // env fallback). This defends against a stale `export GITHUB_REPO=…` in
  // the operator's shell — Next.js's .env.local does NOT override existing
  // shell env, so without this override, MCP writes can land on the wrong
  // repo (e.g., private business YAML landing on the public OSS repo).
  // Non-fatal on failure: fall back to whatever the shell provides.
  let overrideRepo: { slug?: string; branch?: string } = {};
  try {
    const resolved = await resolveTargetRepo();
    overrideRepo = { slug: `${resolved.owner}/${resolved.name}`, branch: resolved.branch };
  } catch (e) {
    console.error("[chat] resolveTargetRepo failed — falling back to shell GITHUB_REPO:", e);
  }

  const proc = spawn(
    "claude",
    args,
    {
      // Set cwd to the repo root so any file-relative behavior inside MCP
      // servers (equity/mcp/server.ts reads GITHUB_REPO env + kubeconfig
      // by path) resolves against the repo, not the console/ dir.
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        // Force OAuth path — empty out any inherited API key.
        ANTHROPIC_API_KEY: "",
        // Repo-target override (see comment above).
        ...(overrideRepo.slug ? { GITHUB_REPO: overrideRepo.slug } : {}),
        ...(overrideRepo.branch ? { GITHUB_BRANCH: overrideRepo.branch } : {}),
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
