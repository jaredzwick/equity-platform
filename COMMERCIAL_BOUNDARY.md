# Commercial boundary

This repo is the **open-source core** of equity-platform. Pypes LLC also
operates a **commercial hosted SaaS** built on top of this core. This
document is the contract between the two halves — so it stays honest which
side owns what.

## The core (this repo, BSL 1.1)

**Everything a solo operator needs to self-host the platform for their own
business, forever, at $0.**

| Area | What's here |
|---|---|
| Cluster boot | `local/` — kind + ArgoCD + platform apps in one command |
| GitOps | `bootstrap/`, `apps/`, `charts/` — reconcile every change from git |
| Console UI | `console/` — Next.js 15 multi-tenant console (Overview, Apps, Cron, Email, Events, History, Profile, Logo, Chat) |
| GitOps writeback | Server actions that commit to your GitHub repo |
| GitHub App OAuth | Device flow + auto-fork of the upstream template |
| AI features | Logo studio, chat — you bring your own `OPENAI_API_KEY` |
| Entitlements | `console/lib/entitlements.ts` — always returns "allowed" for self-hosters |

Self-hosters get **every feature**. There is no crippling — the entitlements
plugin defaults to open on all checks.

## The commercial layer (private, not in this repo)

**Everything Pypes LLC needs to run this as a multi-tenant SaaS for paying
customers.**

| Area | Lives in |
|---|---|
| Stripe billing, subscriptions, plans | Private repo + Stripe |
| Multi-tenant org / user management | Private repo (overlay on `console/`) |
| Entitlement gates (metered AI, seat limits, etc.) | Private module that plugs into `checkEntitlement()` |
| Admin dashboard (support, refunds, impersonation) | Private repo |
| Managed K8s clusters, backups, oncall, SLA | Ops |
| Sales, docs marketing, `pypes.dev` marketing site | Private repo |

None of this is required to run the OSS core.

## How the split works

The core defines **extension points**; the commercial layer implements them.
There is exactly one seam today, and it's designed to be the only one we'll
add for a while:

### `checkEntitlement(action, ctx)` — `console/lib/entitlements.ts`

Every server action / API route that does something metered or gated calls
`checkEntitlement()` first.

- **OSS default**: returns `{ ok: true, plan: "self-hosted" }` for every
  action. Self-hosters get everything.
- **Commercial override**: set `COMMERCIAL_ENTITLEMENTS_MODULE=<import path>`
  in production env. The core dynamically imports that module at startup
  and delegates every check to it. The commercial module reads the
  requesting user's org + plan + usage counters from a private database
  and returns either `{ ok: true }` or
  `{ ok: false, reason, upgrade_url }`.

**Rules for anything that's paid-only in SaaS:**
1. Call `checkEntitlement()` server-side, before doing the work.
2. Return HTTP 402 (Payment Required) with the reason + upgrade URL.
3. **Never** implement the gate in client code — anyone can fork and
   flip a flag.
4. The check must **fail closed** in the commercial overlay and **open**
   in OSS (default).

### Adding more seams

Resist the urge. Every new seam creates a coordination problem between OSS
and commercial. Prefer:
- Fetching data via a swappable client (e.g., `getUserOrg()`) that returns
  a single-tenant default in OSS.
- Wrapping routes with generic middleware in the commercial repo rather
  than adding hooks in the core.

## Trademark + naming

"equity-platform" and "Pypes" are trademarks of Pypes LLC. You may fork,
modify, and redistribute source, but derivative works must not use these
names in a way that suggests endorsement or affiliation with Pypes LLC.

## Contributing back

Contributions to the OSS core are welcome under BSL 1.1. By opening a PR
you agree that your contribution is licensed under the same terms (see
`CONTRIBUTING.md`). If you're building something that belongs in the
commercial layer, open an issue first — we'll usually redirect it.
