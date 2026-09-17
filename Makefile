# Makefile — small operator wrappers on top of local/up.sh + docker.
# Not a full build system; just the commands that would otherwise be
# copy-pasted from READMEs.

.PHONY: runner runner-secret help

CLUSTER_NAME ?= equity-local
RUNNER_IMAGE ?= equity/claude-runner:latest
RUNNER_DIR   := runners/claude-runner

help: ## Show this help.
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-16s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

runner: ## Build equity/claude-runner:latest and load it into the local kind cluster.
	docker build -t $(RUNNER_IMAGE) $(RUNNER_DIR)
	kind load docker-image $(RUNNER_IMAGE) --name $(CLUSTER_NAME)
	@echo "✓ $(RUNNER_IMAGE) built + loaded into kind cluster '$(CLUSTER_NAME)'"
	@echo "  Next: run 'make runner-secret NS=<your-tenant-ns>' once per namespace."

runner-secret: ## Create the claude-runner-auth Secret in namespace NS. Requires CLAUDE_CODE_OAUTH_TOKEN in env.
	@if [ -z "$(NS)" ]; then echo "✗ pass NS=<tenant-namespace>"; exit 2; fi
	@if [ -z "$$CLAUDE_CODE_OAUTH_TOKEN" ]; then echo "✗ CLAUDE_CODE_OAUTH_TOKEN not set in env — source it from console/.env.local"; exit 2; fi
	kubectl create secret generic claude-runner-auth \
	  --from-literal=oauth-token="$$CLAUDE_CODE_OAUTH_TOKEN" \
	  -n $(NS) \
	  --dry-run=client -o yaml | kubectl apply -f -
	@echo "✓ claude-runner-auth Secret bootstrapped in namespace '$(NS)'"
