# Contributing

Thanks for considering a contribution. This is a small opinionated infra
scaffold — PRs are welcome but the bar is: does this help someone launch
faster, or does it add a knob?

## Local dev

```bash
brew install kind kubectl helm
./local/up.sh    # ~3 min
./local/down.sh  # tears everything down
```

## Rules

- **Boring by default.** New dependencies get scrutiny. If a chart addition
  can be replaced by an existing chart's values change, prefer the values change.
- **Pinned versions.** Every chart in `apps/*.yaml` pins a `targetRevision`.
  No `HEAD` or floating tags.
- **Test what you change.** Run `./local/up.sh` after any change to
  `bootstrap/`, `apps/`, or `charts/` and confirm all Applications reach
  `Synced` / `Healthy` before opening the PR.
- **Shell scripts get `shellcheck`.** YAML gets `yamllint`. CI enforces both.

## Signing off

By opening a PR you agree the contribution is under the repo's MIT license.
