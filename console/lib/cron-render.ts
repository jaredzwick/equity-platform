// Pure cron rendering + validation. No dependencies on @/lib/* — this file
// is safe to import from BOTH the Next.js runtime (via provision.ts) AND
// the standalone equity-mcp stdio server (console/mcp/server.ts).
//
// Keep it pure: any I/O (github, k8s, session) belongs upstream in the caller.

export const CLAUDE_RUNNER_IMAGE = "equity/claude-runner:latest";
export const CLAUDE_RUNNER_SECRET = "claude-runner-auth";
export const CLAUDE_RUNNER_NATS_URL = "nats://nats.nats.svc.cluster.local:4222";

export type ConcurrencyPolicy = "Allow" | "Forbid" | "Replace";
export const ALLOWED_CONCURRENCY: ConcurrencyPolicy[] = ["Allow", "Forbid", "Replace"];

export type ProvisionCronInput =
  | {
      mode: "shell";
      tenant: string;
      name: string;
      namespace: string;
      schedule: string;
      image: string;
      command: string;
      concurrencyPolicy: ConcurrencyPolicy;
    }
  | {
      mode: "runner";
      tenant: string;
      name: string;
      namespace: string;
      schedule: string;
      prompt: string;
      concurrencyPolicy: ConcurrencyPolicy;
    };

// A very rough cron-expression check. Full parsing is non-trivial (@daily,
// L, W, ?, etc.) — we let kubectl reject anything genuinely broken and just
// catch obvious garbage here.
export function looksLikeCron(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed.startsWith("@")) {
    return /^@(hourly|daily|weekly|monthly|yearly|annually|reboot)$/.test(trimmed);
  }
  const parts = trimmed.split(/\s+/);
  return parts.length === 5 || parts.length === 6;
}

export function validName(s: string): boolean {
  return /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(s) && s.length <= 52;
}

// MASTER_SLUG is duplicated here (also in lib/tenants.ts) so this module
// has zero @/lib coupling. If they ever diverge, tests catch it.
const MASTER_SLUG = "master";

export function validateProvisionInput(
  input: ProvisionCronInput,
): { ok: true } | { ok: false; error: string } {
  if (input.tenant === MASTER_SLUG) {
    return { ok: false, error: "Pick a business first — master view can't own crons." };
  }
  if (!validName(input.name)) {
    return { ok: false, error: "Name must be kebab-case, ≤52 chars." };
  }
  if (!input.namespace) {
    return { ok: false, error: "Namespace required." };
  }
  if (!looksLikeCron(input.schedule)) {
    return { ok: false, error: "Schedule must be a 5-field cron expression or an @keyword." };
  }
  if (input.mode === "shell") {
    if (!input.image) return { ok: false, error: "Image required (e.g. busybox:1.36)." };
    if (!input.command) return { ok: false, error: "Command required." };
  } else {
    if (!input.prompt || !input.prompt.trim()) {
      return { ok: false, error: "Prompt required — describe what the runner should do." };
    }
  }
  if (!ALLOWED_CONCURRENCY.includes(input.concurrencyPolicy)) {
    return { ok: false, error: "Invalid concurrency policy." };
  }
  return { ok: true };
}

export function renderCronYaml(input: ProvisionCronInput): string {
  const header = `apiVersion: batch/v1
kind: CronJob
metadata:
  name: ${input.name}
  namespace: ${input.namespace}
  labels:
    equity.io/tenant: ${input.tenant}
    equity.io/managed-by: console${input.mode === "runner" ? "\n    equity.io/runner: claude" : ""}
spec:
  schedule: "${input.schedule}"
  concurrencyPolicy: ${input.concurrencyPolicy}
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: worker`;

  if (input.mode === "shell") {
    // Command runs via /bin/sh -c so users can write natural shell pipelines.
    const escapedCmd = input.command.replace(/'/g, "'\\''");
    return `${header}
              image: ${input.image}
              command: ["/bin/sh", "-c"]
              args:
                - '${escapedCmd}'
`;
  }

  // Runner mode: fixed image + entrypoint, prompt lives in env. YAML block
  // scalar (|-) preserves newlines and quotes without shell-escape pain.
  const promptIndented = input.prompt
    .split("\n")
    .map((l) => `                    ${l}`)
    .join("\n");
  return `${header}
              image: ${CLAUDE_RUNNER_IMAGE}
              imagePullPolicy: IfNotPresent
              command: ["/entrypoint.sh"]
              env:
                - name: PROMPT
                  value: |-
${promptIndented}
                - name: TENANT
                  value: ${input.tenant}
                - name: CRON_NAME
                  value: ${input.name}
                - name: NATS_URL
                  value: ${CLAUDE_RUNNER_NATS_URL}
                - name: CLAUDE_CODE_OAUTH_TOKEN
                  valueFrom:
                    secretKeyRef:
                      name: ${CLAUDE_RUNNER_SECRET}
                      key: oauth-token
`;
}

// buildCronJobBody produces the same shape as renderCronYaml, but as a JS
// object for the k8s client. Kept next to renderCronYaml so drift between
// the two is visible in one diff.
export function buildCronJobBody(input: ProvisionCronInput) {
  const labels: Record<string, string> = {
    "equity.io/tenant": input.tenant,
    "equity.io/managed-by": "console",
  };
  if (input.mode === "runner") labels["equity.io/runner"] = "claude";

  const container = input.mode === "shell"
    ? {
        name: "worker",
        image: input.image,
        command: ["/bin/sh", "-c"],
        args: [input.command],
      }
    : {
        name: "worker",
        image: CLAUDE_RUNNER_IMAGE,
        imagePullPolicy: "IfNotPresent",
        command: ["/entrypoint.sh"],
        env: [
          { name: "PROMPT", value: input.prompt },
          { name: "TENANT", value: input.tenant },
          { name: "CRON_NAME", value: input.name },
          { name: "NATS_URL", value: CLAUDE_RUNNER_NATS_URL },
          {
            name: "CLAUDE_CODE_OAUTH_TOKEN",
            valueFrom: {
              secretKeyRef: { name: CLAUDE_RUNNER_SECRET, key: "oauth-token" },
            },
          },
        ],
      };

  return {
    apiVersion: "batch/v1",
    kind: "CronJob",
    metadata: {
      name: input.name,
      namespace: input.namespace,
      labels,
    },
    spec: {
      schedule: input.schedule,
      concurrencyPolicy: input.concurrencyPolicy,
      successfulJobsHistoryLimit: 3,
      failedJobsHistoryLimit: 1,
      jobTemplate: {
        spec: {
          template: {
            spec: {
              restartPolicy: "OnFailure",
              containers: [container],
            },
          },
        },
      },
    },
  };
}
