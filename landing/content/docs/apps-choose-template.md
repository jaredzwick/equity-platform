---
title: "Which template should I pick?"
description: "A decision tree through the curated one-click app templates: databases, caches, storage, analytics, CMS, automation, observability, and dev tools."
keywords: ["Helm chart templates", "self-hosted apps", "PostgreSQL", "Redis", "MinIO", "Grafana", "n8n", "Ghost"]
category: "Apps"
summary: "Decision tree through the ten one-click templates: what each is good for, what to install first."
icon: "question"
order: 2
lastmod: "2026-08-04"
---

## The two-minute answer

Most tenants pick these first:

1. **PostgreSQL** — the default relational database. Install this early, point
   your apps at it, don't overthink it.
2. **Redis** — for caches, queues, rate limits, session stores. Install when
   your first app that needs it goes in.
3. **MinIO** — S3-compatible object storage. Install when you need to store
   files (uploads, generated PDFs, backups) without paying S3.
4. **Grafana** — dashboards for the platform's built-in Prometheus. Install
   once, then every future app gets observability for free.

Everything else is need-driven.

## By what you're trying to do

### I need to store structured data
→ **PostgreSQL**. It's boring, correct, and battle-tested. Skip
"NoSQL first" instincts unless you already know why you need one.

### I need a cache or a queue
→ **Redis**. Sub-millisecond gets, pub/sub, streams, and it's the queue
backend for almost every job runner. If you outgrow it, you'll know.

### I need to store files (uploads, backups, generated blobs)
→ **MinIO**. S3-compatible so your app code stays portable; when you move to
real S3 later, it's a URL change.

### I need to see graphs of what's happening
→ **Grafana**. Talks to the Prometheus instance the platform ships with. Two
clicks to a dashboard for CPU, memory, and per-pod metrics.

### I need to watch for downtime and get pinged
→ **Uptime Kuma**. HTTP/TCP/DNS/ping checks, status pages, notifications to
Slack/Discord/email.

### I need to automate a workflow (webhooks, integrations, scheduled jobs)
→ **n8n**. Visual editor, hundreds of nodes, self-hosted. Think Zapier but
you own the box.

### I need a blog, newsletter, or membership site
→ **Ghost**. Editorial-first, has memberships and Stripe integration built in.
If you need a general-purpose CMS with plugins, look elsewhere; Ghost is
opinionated on purpose.

### I need site analytics but hate cookie banners
→ **Plausible**. Cookieless, GDPR-friendly, tiny script. Doesn't do
per-user tracking (that's the point).

### I need full-text search inside my app
→ **Meilisearch**. Fast, typo-tolerant, easy to run. Elasticsearch is
overkill until it isn't.

### I need to test emails locally
→ **MailHog**. Catches SMTP, shows the emails in a web UI. Only for dev
namespaces — do not run in prod.

## Things to know before installing

**Placeholder passwords.** Every template ships with `change-me-in-secret` as
the default password. Replace it in the Values YAML before submitting, or wire
it to an ExternalSecret (see the [custom chart guide](/docs/apps-custom-chart)
for the pattern).

**Storage sizes.** Templates default to modest sizes (2–20 GiB). If you know
you'll need more, bump `persistence.size` before submitting. Growing a PVC
after install works on most storage classes but is easier to get right up
front.

**Namespaces.** The template picker defaults to your tenant's namespace. You
can override that per-app if you want to isolate an app (e.g., "analytics"
alongside "app-prod"), but only if that namespace already exists in the
cluster — the console won't create one for you.

**Duplicate installs.** The picker disables cards for chart names you already
have installed. If you actually want two copies of the same chart (e.g., a
staging Postgres and a prod Postgres), use the [custom chart
page](/docs/apps-custom-chart) and give them different app names.

## What's NOT in the template list

Templates are curated. They're not everything you can install. If you want
Elasticsearch, ClickHouse, RabbitMQ, Vault, Jaeger, MongoDB, MySQL, MariaDB,
Nextcloud, Rocket.Chat, Mattermost, Gitea, or any of the thousands of other
public Helm charts — use the [custom chart page](/docs/apps-custom-chart). The
provisioning code is identical; you just fill in the four fields the templates
would have filled for you.
