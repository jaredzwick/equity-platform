---
title: "The equity-console GitHub App — what it does, what it can't"
description: "The GitHub App installed on your fork grants the console write access to your repo. What permissions it needs, why, and how to remove them."
keywords: ["GitHub App", "OAuth", "fork provisioning", "permissions"]
category: "Guides"
summary: "The App writes YAML to your fork on your behalf. It does nothing else."
icon: "shield"
order: 2
lastmod: "2026-08-04"
---

# The equity-console GitHub App

Sign-in and write-back are two separate things.

**Sign-in** happens through a standard GitHub OAuth web flow. It gives us a short-lived token to fork the upstream repo on your behalf.

**Write-back** — the console committing YAML to your fork when you provision a new app or business — happens through a GitHub App you install on your fork. It's a separate, scoped grant.

## Why an App instead of just OAuth

Two reasons:

1. **Repo-scoped, not user-scoped.** The App is installed on one repo (your fork). It can't touch your other repos, even if the OAuth token gets leaked. OAuth tokens are user-wide.
2. **Revocable independently.** You can uninstall the App from your fork without signing out of the landing site. Or vice versa.

## Permissions the App requests

| Permission | Level | Why |
|---|---|---|
| **Contents** | Read + Write | Commit YAML changes to `bootstrap/`, `apps/`, and `businesses/` when you provision from the UI. |
| **Metadata** | Read | Mandatory GitHub baseline for any App. |

That's the entire list. No issues, no PRs, no secrets, no admin, no packages, no actions. If a future feature ever needs another scope, it'll ask you to re-approve — GitHub enforces this.

## Installing the App

From the onboarding page: click **Install App on my fork**. GitHub takes over from there. Approve the install, hit **Save**, you're returned to onboarding with a green checkmark.

If you missed it during onboarding, install anytime from `github.com/apps/equity-console`.

## Uninstalling

`github.com/settings/installations` → find equity-console → **Uninstall**. The console will fall back to read-only mode. Everything else keeps working; you just can't provision from the UI until you re-install.

## What the App can't do

- It **cannot** read or write any repo other than the one it's installed on.
- It **cannot** access secrets or environment variables in your repo.
- It **cannot** trigger workflows on your behalf (no `Actions: Write`).
- It **cannot** merge PRs. Every commit is a direct commit to the branch you configured (default `main`) — same as `git commit && git push`.

## Read-only mode

If you'd rather not install the App at all, that's fine. The console works read-only: you can view every dashboard tab, but the **+ New Application** and **+ New Business** buttons show a "configure write-back to enable" message. You can still create everything by hand — edit YAML in your fork, `git push`, ArgoCD reconciles.
