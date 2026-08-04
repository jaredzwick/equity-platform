---
title: "Licensing — BSL 1.1, and what you can do with it"
description: "The repo is BSL 1.1, auto-converting to Apache 2.0 on 2030-08-03. Here's what that means in plain English, and where the commercial boundary sits."
keywords: ["BSL 1.1", "Business Source License", "Apache 2.0", "open source", "commercial license"]
category: "Reference"
summary: "Self-host it forever, free. Fork it, modify it, redistribute it. Just don't sell it as a hosted competitor to us."
icon: "scroll"
order: 2
lastmod: "2026-08-04"
---

# Licensing

The repo is licensed under **Business Source License 1.1** (BSL 1.1), with an automatic conversion to **Apache 2.0** on **2030-08-03**.

The full text is in [LICENSE](https://github.com/jaredzwick/equity-platform/blob/main/LICENSE). Below is the plain-English version — this is a summary, not legal advice.

## What you can do

- **Self-host it internally** to run your own business, forever, for free. This includes commercial internal use.
- **Read, modify, fork, and redistribute** the source code.
- **Deploy modifications** to your own infrastructure without upstreaming them.
- **Use it in production** — there is no "for evaluation only" restriction.

## What you can't do (yet)

- **Offer it as a hosted or managed SaaS to third parties** that competes with Pypes LLC's hosted version. That requires a commercial license — email `commercial@pypes.dev`.

That single restriction is the only difference between BSL 1.1 and a permissive OSS license. The "compete with the hosted version" test is deliberately narrow — running it for your own business is fine, running it for a client under a service agreement is fine, embedding pieces of it in a larger internally-facing tool is fine.

## The conversion date

On **2030-08-03**, or four years after each release (whichever is later), the license auto-converts to Apache 2.0. From that point on, every restriction above disappears — you can run a hosted competitor if you want. This isn't a marketing clause; it's baked into the LICENSE file.

The rationale: BSL keeps the runway alive during the commercial-viability window; the conversion clock keeps it honest as an open-source project long-term.

## The commercial boundary

Pypes LLC operates a commercial hosted equity-platform. That hosted product is **not** covered by this repository — it's a separate offering with different code, different infra, and different licensing.

The split is documented at [COMMERCIAL_BOUNDARY.md](https://github.com/jaredzwick/equity-platform/blob/main/COMMERCIAL_BOUNDARY.md) in the repo. Read that if you're planning anything commercially adjacent.

## Contributions

Contributions to the upstream repo are accepted under BSL 1.1 (with the same 2030 conversion). By opening a PR, you're agreeing to license your contribution under those terms. See [Contributing](/docs/contributing).

## Not legal advice

Everything above is a summary. The actual license text in [LICENSE](https://github.com/jaredzwick/equity-platform/blob/main/LICENSE) controls. If you have a specific legal question — especially "can I do X with this?" — talk to your lawyer, not to us. Or email `commercial@pypes.dev` and we'll route it appropriately.
