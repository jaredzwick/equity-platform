---
title: "FAQ — the questions we get most"
description: "Is it really free? Do I need a Kubernetes background? What does the hosted onramp actually do? Answers in one sentence each."
keywords: ["FAQ", "questions", "equity-platform", "LamboApp"]
category: "Reference"
summary: "Is it free (yes), do I need k8s expertise (no), what's the hosted onramp (fork provisioning only)."
icon: "question"
order: 4
lastmod: "2026-08-04"
---

# FAQ

## Is it really free?

Yes. The local kind cluster costs $0 to run. You supply your own machine. If you deploy to a paid cloud Kubernetes, you pay the cloud — not us.

The BSL 1.1 license is free for self-hosting forever. The only paid tier is the commercial hosted platform (which is a separate offering not covered by this repo — see [Licensing](/docs/licensing)).

## Do I need a Kubernetes background?

No. The console is designed so you never need to touch `kubectl` for normal operation. You'll need Docker Desktop running and the ability to `brew install` a few tools. If you can follow the [Quickstart](/docs/quickstart), you have enough.

If something goes wrong, you might need to read `kubectl logs` output. But the intended path is: use the UI, and only drop to CLI when the UI can't do what you want.

## What does the hosted landing site actually do?

Three things and only three things:

1. **Sign you in** via GitHub OAuth.
2. **Fork the upstream repo** to your account.
3. **Walk you through installing the GitHub App** on your fork.

That's it. It does not run your cluster. It does not host your code. Once you've forked, you clone your fork locally and run everything from there.

## Can I skip the landing site entirely?

Yes. Clone the upstream repo directly:

```bash
git clone https://github.com/jaredzwick/equity-platform ~/equity-platform
cd ~/equity-platform
./local/up.sh
```

You lose the fork-provisioning convenience and the GitHub App install helper, but the platform itself doesn't need the landing site at all.

## Why GitHub? Can I use GitLab or Bitbucket?

GitHub is the current default because ArgoCD's GitHub integration is the best-documented. Nothing about the platform is fundamentally tied to GitHub — the writeback path uses the GitHub Contents API, which would need a small adapter for GitLab/Bitbucket. Contributions welcome (see [Contributing](/docs/contributing)).

## What data do you collect from me?

The landing site stores:
- Your GitHub username and avatar URL (to display in the header).
- Your fork name (to know which repo to point you at).
- An encrypted session cookie so you don't have to sign in every time.

That's the entire list. We don't have your GitHub token beyond the OAuth session; we don't have access to your fork after you sign out (unless you separately installed the GitHub App, which is scoped to that one repo).

We don't run analytics beyond first-party server logs, and we don't sell anything.

## Is the AI scorer configurable?

Not yet from the UI. The scoring rubric is currently hard-coded to a specific archetype (boring, cash-flowing, sub-$5M SDE, service-heavy). A per-user rubric — "score for e-commerce with >$1M revenue" — is on the internal roadmap but not shipped.

For now: use the deal filter to narrow the feed, and read the thesis paragraph to decide fit.

## Can I use this for something other than buying businesses?

Sure. The platform layer (`bootstrap/`, `apps/`, `charts/`, `console/`) is a general-purpose multi-tenant k8s platform. LamboApp is one tenant on top. Nothing stops you from adding your own tenants for whatever you want to run.

## How do I get help?

- **Docs** — you're reading them.
- **GitHub issues** — [github.com/jaredzwick/equity-platform/issues](https://github.com/jaredzwick/equity-platform/issues) for bugs and questions.
- **Commercial inquiries** — `commercial@pypes.dev`.
