---
title: "AI scoring — how Claude reads every listing"
description: "The AI scorer that reads each listing, writes a one-paragraph thesis, flags red flags, and assigns a fit score. What it does, what it doesn't do, and how it fails."
keywords: ["Claude", "AI due diligence", "SMB scoring", "deal screening", "acquisition analysis"]
category: "Concepts"
summary: "Claude reads every listing, writes a thesis, flags the obvious scams, and assigns a fit score. It is not due diligence."
icon: "brain"
order: 3
lastmod: "2026-08-04"
---

# AI scoring

Every listing that enters the pipeline gets read by Claude before it ever appears in the feed. The output is three things:

1. **A one-paragraph thesis** — what this business is, why someone might want it, and what the plausible path to a return looks like.
2. **Red flags** — the obvious tells that this is a scam, a distressed pump, or a numbers-don't-add-up situation.
3. **A fit score** — how well this matches the archetype of "boring, cash-flowing, sub-$5M SDE, not a tech gamble."

## What "red flag" means

The scorer is looking for the mechanical tells that recur across bad listings:

- Revenue "since inception" that doesn't reconcile with the age of the business.
- SDE that's a suspiciously high fraction of revenue (>60% is unusual for real service businesses).
- Broker language that overuses "turnkey," "absentee," "scalable" without any of the numbers those words imply.
- Missing lease terms on brick-and-mortar deals.
- Amazon/Etsy dependency where the platform account isn't part of the sale.
- Founder-in-the-picture businesses being sold as "systems in place."

It's not exhaustive and it's not a substitute for reading the listing yourself. It surfaces the obvious cases so you can spend your reading time on the deals that survived a first pass.

## What the fit score is (and isn't)

The fit score is a scalar 0–100 that answers one question: *given the archetype of a solid acquisition target, how well does this listing match?* Higher is better. The archetype is roughly:

- 5+ years established.
- Sub-$5M SDE.
- SDE multiple in the 2x–4x range.
- Not obviously dying (declining revenue trend, single-customer dependency, dead industry).
- Real operational moat (not just a domain name).

**It is not a buy signal.** It is a "worth 15 minutes of your reading time" signal.

## What it doesn't do

- **It doesn't do financial due diligence.** No P&L reconstruction, no working-capital normalization, no tax analysis. That's the QoE analyst's job after you're under LOI.
- **It doesn't judge the operator side.** Whether *you* are the right person to run a laundromat is out of scope.
- **It doesn't predict outcomes.** Every past acquisition failed to hit projections; every future one will too. The score is a filter, not a forecast.

## Failure modes

The scorer will occasionally:

- Miss a red flag because the listing hides it in a photo caption or a broker-supplied PDF.
- Flag a legitimate business as risky because the broker copy is unusually promotional.
- Score a niche business (e.g., a specialty machine shop) as "low fit" simply because the archetype prior is skewed toward service SMBs.

The right way to use the output: read the thesis, read the red flags, then form your own opinion. Don't outsource the reading — outsource the *filtering to find things worth reading.*
