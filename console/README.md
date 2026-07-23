# equity-console

One-pane visibility for equity-platform. Reads from Kubernetes API +
ArgoCD + NATS + Prometheus + Postgres and shows: what's deployed, what's
running, what's stale, what's bouncing.

## Pages (v0.1)

- **`/`** — Overview: ArgoCD app counts + status table
- **`/cron`** — Every CronJob across every namespace, stale-detection heuristic
- **`/email`** — Deliverability, bounce rate, complaint rate (Resend webhook backed) — placeholder until DB wired
- **`/events`** — NATS JetStream streams + consumers — placeholder until NATS wired
- **`/apps`** — Detail view — placeholder for v0.2

## Local dev

```bash
cd console/
npm install
npm run dev
open http://localhost:3030
```

Requires:
- Node.js 20+
- A `kubectl` context pointing at a cluster (the console reads from
  whichever cluster your `~/.kube/config` current-context points at)

If the equity-platform kind cluster is up (`./local/up.sh` from the repo root),
`kubectl config current-context` should be `kind-equity-local` and the
console will show your local apps + cronjobs.

## Deploy to the cluster

TODO: `apps/console.yaml` + `services/console/helm/` chart.

For now, run locally against the port-forwarded services.

## Env

| Var | Default | Purpose |
|---|---|---|
| `KUBECONFIG` | `~/.kube/config` | Path to kubeconfig; auto-detected when running in-cluster |
| `EMAIL_DB_URL` | unset | Postgres URL for the email_events table (deliverability page) |
| `NATS_MONITOR_URL` | `http://localhost:8222` | NATS monitoring endpoint (events page) |
| `GRAFANA_URL` | `http://localhost:3000` | Grafana base URL for iframe embeds |

## Architecture

```
                              ┌─── Kubernetes API (ArgoCD apps, CronJobs, Pods)
                              │
  browser ──▶ Next.js SSR ────┼─── Prometheus HTTP API (metrics, alerts)
              (server         │
               components)    ├─── NATS monitoring (streams, consumers)
                              │
                              ├─── Postgres (email_events, business data)
                              │
                              └─── Grafana (iframe-embedded panels)
```

Server components fetch on every request (`export const dynamic = "force-dynamic"`),
so the page is always live. No client-side polling needed for v0.1.
Add `revalidate = 10` if we want cached rendering later.

## Design notes

- **Read-only.** Console never mutates cluster state. That's ArgoCD's job.
  If you want to force-sync an app, use the ArgoCD UI (link out from the app row).
- **In-cluster + local both work.** `@kubernetes/client-node` auto-detects
  via `KUBERNETES_SERVICE_HOST`.
- **Cron staleness heuristic is dumb-simple.** Anything >24h since last success
  = red. Future: parse the actual cron schedule and compare against `interval * 2`.
- **Grafana panels via iframe.** Cheaper than rebuilding time-series in recharts.
  Content-Security-Policy in `next.config.ts` allows the frame source.

## License

MIT (matches repo root).
