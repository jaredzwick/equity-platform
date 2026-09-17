# equity/claude-runner — generic AI-cron runner.
#
# Every AI-scheduled cron in equity-platform runs this image. The container:
#   1. Reads $PROMPT, $TENANT, $CRON_NAME, $NATS_URL, $CLAUDE_CODE_OAUTH_TOKEN
#   2. Spawns `claude --print $PROMPT` and captures stdout + exit code
#   3. Publishes an envelope to events.$TENANT.cron.completed via JetStream
#   4. Exits with claude's exit code
#
# Build + load locally (single-operator model):
#   make runner
#
# The image deliberately DOES NOT ship an .mcp.json. An AI cron running
# inside a container with access to the create_business / create_cron
# tools would be a bad idea — the runner is meant to reason with the LLM
# and report back, not to mutate cluster state. Add per-cron MCP toolbelts
# via env-driven MCP config later if warranted.

FROM node:20-slim

# Curl for the ANTHROPIC diagnostic path; ca-certificates for HTTPS to
# claude + nats. tini as PID 1 so the entrypoint's node subprocess gets
# proper signal forwarding when the pod is killed.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates \
       curl \
       tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /runner

# Install claude-code CLI + nats client at image-build time. Pinning
# versions here so a random npm publish can't break existing scheduled
# crons — bump on purpose.
COPY package.json package-lock.json* ./
RUN npm install --production --no-audit --no-fund \
    && npm cache clean --force

COPY runner.mjs ./runner.mjs
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
