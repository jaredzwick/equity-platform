// Pure parser: detect cron proposals inside an assistant chat message.
//
// The chat's CRON_PRIMER instructs the model to emit its proposal as a
// ```yaml``` code block containing `name:`, `schedule:`, and either
// `prompt:` (runner mode) or `image:` + `command:` (shell mode). We
// look for that pattern and pull the prompt out so the "▶ Play" button
// on the chat UI can dry-run it without a full YAML dep in the client.
//
// Kept pure + zero deps so it works in the client bundle (chat UI is a
// client component) and is trivially unit-testable.

export type CronProposal = {
  mode: "runner" | "shell";
  name?: string;
  schedule?: string;
  namespace?: string;
  concurrencyPolicy?: string;
  prompt?: string;              // runner mode
  image?: string;               // shell mode
  command?: string;             // shell mode
  yamlBlock: string;            // raw YAML content between the fences (useful for dry-run POST)
};

// Grab the FIRST ```yaml … ``` code block in the message. If the model
// emits multiple (e.g. an example + the real proposal), the model has
// been instructed via CRON_PRIMER to put the actual proposal first;
// treat any subsequent ones as examples the operator shouldn't act on.
export function extractCronProposal(content: string): CronProposal | null {
  const match = /```(?:yaml|yml)\s*\n([\s\S]*?)```/i.exec(content);
  if (!match) return null;
  const yamlBlock = match[1];

  // Extract top-level `key: value` lines with a targeted regex. Full YAML
  // parsing is overkill and pulls in js-yaml — the model's output is
  // uniform (per CRON_PRIMER) so line-oriented extraction is safe.
  const name = pickScalar(yamlBlock, "name");
  const schedule = pickScalar(yamlBlock, "schedule");
  const namespace = pickScalar(yamlBlock, "namespace");
  const concurrencyPolicy = pickScalar(yamlBlock, "concurrencyPolicy")
    ?? pickScalar(yamlBlock, "concurrency");
  const image = pickScalar(yamlBlock, "image");
  const command = pickScalar(yamlBlock, "command");
  const prompt = pickBlockScalar(yamlBlock, "prompt");

  const hasMinimum = !!name && !!schedule;
  const hasRunnerFields = !!prompt;
  const hasShellFields = !!image && !!command;

  if (!hasMinimum) return null;
  if (!hasRunnerFields && !hasShellFields) return null;

  return {
    mode: hasRunnerFields ? "runner" : "shell",
    name,
    schedule,
    namespace,
    concurrencyPolicy,
    prompt,
    image,
    command,
    yamlBlock,
  };
}

// Match a bare scalar line: `key: value` (value on same line). Ignores
// object/array continuations. Returns the trimmed value with quotes
// stripped. Returns undefined when the key is present as a block-scalar
// (value on subsequent lines) — pickBlockScalar handles that case.
function pickScalar(yamlBlock: string, key: string): string | undefined {
  const re = new RegExp(`^\\s*${escape(key)}\\s*:\\s*(.*?)\\s*$`, "m");
  const m = re.exec(yamlBlock);
  if (!m) return undefined;
  const raw = m[1];
  if (raw === "" || raw === "|" || raw === "|-" || raw === "|+" || raw === ">" || raw === ">-" || raw === ">+") {
    // Block scalar indicator or empty — treat as "not a scalar value".
    return undefined;
  }
  return unquote(raw);
}

// Match a block-scalar (`key: |` or `key: |-`) and return the dedented
// body. Everything up to the next line at the same-or-lower indent that
// starts a new key is the body. Implemented line-by-line rather than as
// one regex because the multi-line + back-ref combination is fiddly in
// JS regex flavor (no \Z, back-refs across multiline captures).
function pickBlockScalar(yamlBlock: string, key: string): string | undefined {
  const lines = yamlBlock.split("\n");
  const opener = new RegExp(`^([ \\t]*)${escape(key)}\\s*:\\s*(\\|[+-]?|>[+-]?)\\s*$`);
  let startIdx = -1;
  let parentIndent = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = opener.exec(lines[i]);
    if (m) {
      startIdx = i + 1;
      parentIndent = m[1].length;
      break;
    }
  }
  if (startIdx < 0) return undefined;

  // Body ends at the next non-blank line indented ≤ parentIndent.
  const bodyLines: string[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim().length === 0) {
      bodyLines.push(l);
      continue;
    }
    const indent = (l.match(/^(\s*)/)?.[1].length ?? 0);
    if (indent <= parentIndent) break;
    bodyLines.push(l);
  }

  // Trim trailing blank lines so `prompt: |-` and `prompt: |` both feel
  // sensible (the strip-vs-keep distinction is a full-YAML nuance we can
  // add later if it matters).
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === "") {
    bodyLines.pop();
  }
  if (bodyLines.length === 0) return "";

  // Dedent by the minimum leading whitespace across non-blank lines.
  const nonEmpty = bodyLines.filter((l) => l.trim().length > 0);
  const minIndent = Math.min(
    ...nonEmpty.map((l) => (l.match(/^(\s*)/)?.[1].length ?? 0)),
  );
  return bodyLines.map((l) => (l.length >= minIndent ? l.slice(minIndent) : l.trimStart())).join("\n");
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unquote(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}
