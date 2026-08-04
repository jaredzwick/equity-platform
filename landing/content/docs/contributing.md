---
title: "Contributing to equity-platform"
description: "How to contribute to the upstream repo: bug reports, PRs, docs, new integrations. What we merge, what we don't."
keywords: ["contributing", "open source", "PRs", "bug reports"]
category: "Guides"
summary: "Open a PR against jaredzwick/equity-platform. CI must be green. Small PRs land faster than big ones."
icon: "code"
order: 4
lastmod: "2026-08-04"
---

# Contributing

The project is BSL 1.1 (with an Apache 2.0 conversion date in 2030). External contributions are welcome and get treated the same as internal changes.

## Bug reports

Open a GitHub issue at [github.com/jaredzwick/equity-platform/issues](https://github.com/jaredzwick/equity-platform/issues) with:

- What you were trying to do.
- What happened.
- What you expected to happen.
- The output of `./local/up.sh` (or the failing command) if it's a boot/cluster issue.
- The output of the browser console + Network tab if it's a console UI issue.

Reproducers help more than descriptions. A 3-line `bash` snippet that reproduces the bug is worth ten paragraphs of explanation.

## Pull requests

**Small PRs land faster than big ones.** A 30-line focused change is easier to review, test, and revert than a 300-line refactor.

1. Fork the repo (the landing site can do this for you — sign in with GitHub).
2. Branch: `git checkout -b fix/thing-that-was-broken`.
3. Make the change.
4. Confirm CI passes locally where possible:
   - `shellcheck local/*.sh` for shell scripts.
   - `yamllint bootstrap/ apps/` for manifests.
   - `kubeconform bootstrap/*.yaml` for k8s validation.
   - `npm run test` inside `console/` for console changes.
5. Open a PR against `main`. Reference the issue if there is one.

## What we merge

- Bug fixes (obviously).
- New broker integrations for the deal-sourcing pipeline, if they respect the source's `robots.txt` and don't republish full listing copy.
- Documentation improvements.
- New tenant profile fields, if there's a plausible use case.
- CI/lint improvements.
- Additional Kubernetes overlays (DO, EKS, GKE — the roadmap has DO first).

## What we probably won't merge

- Features that reintroduce state outside git. The GitOps invariant is load-bearing; changes that let the console mutate the cluster directly (without a commit) get pushed back.
- New required environment variables that don't have sensible defaults for the kind path.
- Anything that breaks `./local/up.sh` from a fresh clone.
- Additions to `businesses/*.yaml` schema without a matching form field and validation.

## Style

The console follows the conventions in the `.eslintrc` config. Manifests follow `.yamllint`. Shell follows `shellcheck` defaults. If in doubt, match the file you're editing.

## Licensing your contribution

Contributions are accepted under BSL 1.1 (converting to Apache 2.0 in 2030), same as the rest of the repo. By opening a PR, you're agreeing to that license.
