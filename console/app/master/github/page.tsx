import { getSession } from "@/lib/session";
import { resolveTargetRepo, BackupDisabledError } from "@/lib/github";
import { checkAppInstall, appInstallUrl, APP_SLUG, type InstallStatus } from "@/lib/github-oauth";
import SignOutButton from "./SignOutButton";
import { headers } from "next/headers";
import { getArgoRootSource, type ArgoRootSource } from "@/lib/k8s";
import { discoverTenants, discoverTenantsFromRepo, type Tenant } from "@/lib/tenants";
import { readBackupConfig, type BackupConfig } from "@/lib/backup-config";
import BackupCard from "./BackupCard";

export const dynamic = "force-dynamic";

// Normalize a git URL to owner/name so we can compare a session-derived
// target ("pypesdev/equity-platform") against ArgoCD's repoURL
// ("https://github.com/pypesdev/equity-platform.git").
function normalizeRepo(url: string): string | null {
  const m = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

type Props = {
  searchParams: Promise<{
    installed?: string;
    installation_id?: string;
    setup_action?: string;
  }>;
};

// Reconstruct the origin the operator hit us on so we can render a
// copy-pasteable Setup URL that matches. Falls back to the CANONICAL_ORIGIN
// env var (in-cluster / deployed) and finally to the local dev default.
async function currentOrigin(): Promise<string> {
  const h = await headers();
  const forwardedProto = h.get("x-forwarded-proto");
  const forwardedHost = h.get("x-forwarded-host") ?? h.get("host");
  if (forwardedHost) {
    const proto = forwardedProto ?? "http";
    return `${proto}://${forwardedHost}`;
  }
  return process.env.CANONICAL_ORIGIN ?? "http://localhost:3030";
}

export default async function GithubStatusPage({ searchParams }: Props) {
  const { installed: justInstalled, installation_id: justInstalledId } = await searchParams;
  const session = await getSession();
  const authed = !!session.githubToken && !!session.login;
  const origin = await currentOrigin();
  const callbackUrl = `${origin}/api/auth/github/install-callback`;

  const backupCfg: BackupConfig = await readBackupConfig().catch(() => ({
    githubBackup: { enabled: false },
  }));
  const backupEnabled = backupCfg.githubBackup.enabled;

  // resolveTargetRepo now throws BackupDisabledError when nothing's
  // configured — that's the whole point of this UI. Swallow it here so
  // the page still renders the opt-in card.
  const target = await resolveTargetRepo().catch((e) => {
    if (e instanceof BackupDisabledError) return null;
    console.error("[/master/github] resolveTargetRepo:", e);
    return null;
  });
  const targetRepo = target ? `${target.owner}/${target.name}` : null;

  const [installStatus, argoSource, clusterTenants, repoTenants] = await Promise.all([
    authed && targetRepo
      ? checkAppInstall(session.githubToken!, targetRepo).catch((e) => ({
          error: e instanceof Error ? e.message : String(e),
        }))
      : Promise.resolve(null),
    getArgoRootSource(),
    discoverTenants().catch(() => [] as Tenant[]),
    discoverTenantsFromRepo().catch(() => null),
  ]);

  const argoRepoSlug = argoSource ? normalizeRepo(argoSource.repoURL) : null;
  const mismatch =
    !!targetRepo && !!argoRepoSlug && argoRepoSlug.toLowerCase() !== targetRepo.toLowerCase();

  return (
    <div className="max-w-4xl space-y-6">
      <p className="text-sm text-[color:var(--color-muted)]">
        Where the console writes to git, where ArgoCD reads from git, and whether they agree.
      </p>

      {justInstalled && (
        <div className="p-4 border border-emerald-500/40 rounded-lg bg-emerald-950/60 text-sm">
          <div className="font-semibold text-emerald-200 mb-1">
            App installed{justInstalledId ? ` (installation #${justInstalledId})` : ""}
          </div>
          <div className="text-neutral-300 text-xs">
            The console can now write to your fork. If you still see 401s below,
            click <em>Sign out &amp; re-auth</em> so the session picks up the new install.
          </div>
        </div>
      )}

      <BackupCard
        enabled={backupEnabled}
        repoUrl={backupCfg.githubBackup.repoUrl}
        branch={backupCfg.githubBackup.branch}
      />

      <div className="p-4 border border-[color:var(--color-border)] rounded-lg bg-white/[0.02] text-sm space-y-2">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-muted)]">
          GitHub App redirect URI
        </div>
        <div className="text-xs text-[color:var(--color-muted)]">
          The App must have this URL in its <em>Redirect URIs</em> list
          (Identifying and authorizing users section). The console passes it
          explicitly on install, so order in the list does not matter — but
          it must be registered or GitHub rejects the redirect.
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-2 py-1.5 rounded bg-black/40 border border-[color:var(--color-border)] text-xs text-neutral-200 break-all">
            {callbackUrl}
          </code>
          <a
            href={`https://github.com/settings/apps/${APP_SLUG}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs px-2.5 py-1.5 rounded border border-[color:var(--color-border)] hover:bg-white/5 whitespace-nowrap"
          >
            Open App settings →
          </a>
        </div>
      </div>

      {mismatch && (
        <div className="p-4 border border-red-500/40 rounded-lg bg-red-950/60 text-sm">
          <div className="font-semibold text-red-200 mb-1">
            Repo mismatch — teardowns will lose your businesses
          </div>
          <div className="text-neutral-300">
            The console is writing to{" "}
            <code className="text-red-200">{targetRepo}</code>, but ArgoCD is
            reconciling from{" "}
            <code className="text-red-200">{argoRepoSlug}</code>. When you run{" "}
            <code>local/down.sh</code> then <code>local/up.sh</code>, ArgoCD
            re-syncs from the wrong repo and your businesses never come back.
            {" "}
            Fix: re-run{" "}
            <code>local/up.sh --repo-url https://github.com/{targetRepo}.git</code>
            {" "}or set <code>GIT_REPO_URL</code> in your shell.
          </div>
        </div>
      )}

      <Section title="Console → GitHub (writes)">
        <Row label="Signed in">
          {authed ? (
            <span className="inline-flex items-center gap-2">
              {session.avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.avatarUrl}
                  alt=""
                  className="w-4 h-4 rounded-full"
                />
              )}
              <code>{session.login}</code>
            </span>
          ) : (
            <span className="text-amber-300">Not signed in — use the sidebar</span>
          )}
        </Row>
        <Row label="Write target">
          {targetRepo ? (
            <a
              href={`https://github.com/${targetRepo}`}
              target="_blank"
              rel="noreferrer"
              className="underline text-emerald-400"
            >
              <code>{targetRepo}</code>
            </a>
          ) : (
            <span className="text-neutral-500">—</span>
          )}
        </Row>
        <Row label="App installation">
          <InstallState status={installStatus} authed={authed} callbackUrl={callbackUrl} />
        </Row>
      </Section>

      <Section title="Cluster → GitHub (reads)">
        {argoSource ? (
          <>
            <Row label="ArgoCD repo">
              <a
                href={argoSource.repoURL.replace(/\.git$/, "")}
                target="_blank"
                rel="noreferrer"
                className="underline text-emerald-400"
              >
                <code>{argoRepoSlug ?? argoSource.repoURL}</code>
              </a>
            </Row>
            <Row label="Branch / path">
              <code>
                {argoSource.targetRevision} · {argoSource.path}/
              </code>
            </Row>
            <Row label="Sync">
              <StatusPill
                value={argoSource.syncStatus}
                good="Synced"
              />
            </Row>
            <Row label="Health">
              <StatusPill
                value={argoSource.healthStatus}
                good="Healthy"
              />
            </Row>
          </>
        ) : (
          <div className="text-sm text-neutral-400">
            ArgoCD root Application not found. Either the cluster is down
            (<code>local/up.sh</code>) or up.sh was invoked with no git remote —
            see <code>local/up.sh:91</code> (LOCAL-ONLY mode).
          </div>
        )}
      </Section>

      <Section title="Businesses">
        <BusinessDiff cluster={clusterTenants} repo={repoTenants} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[color:var(--color-border)] rounded-lg">
      <div className="px-4 py-2.5 border-b border-[color:var(--color-border)] text-xs uppercase tracking-wider text-[color:var(--color-muted)]">
        {title}
      </div>
      <div className="p-4 text-sm space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 items-baseline">
      <div className="text-[color:var(--color-muted)] text-xs">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function StatusPill({ value, good }: { value: string | null; good: string }) {
  if (!value) return <span className="text-neutral-500">—</span>;
  const isGood = value === good;
  return (
    <span
      className={
        "inline-block px-2 py-0.5 rounded text-xs " +
        (isGood
          ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/60"
          : "bg-amber-950/60 text-amber-300 border border-amber-800/60")
      }
    >
      {value}
    </span>
  );
}

function InstallState({
  status,
  authed,
  callbackUrl,
}: {
  status: InstallStatus | { error: string } | null;
  authed: boolean;
  callbackUrl: string;
}) {
  if (!authed) return <span className="text-neutral-500">—</span>;
  if (!status) return <span className="text-neutral-500">…</span>;

  // An error usually means the stored token is stale (401) or lacks the
  // installations scope (403). Both are recoverable — either reinstall
  // the App on the fork, or sign out and start a fresh device-flow login.
  if ("error" in status) {
    const isAuthErr = /\b(401|403)\b/.test(status.error);
    return (
      <div className="space-y-2">
        <div className={"text-xs " + (isAuthErr ? "text-amber-300" : "text-red-300")}>
          {isAuthErr
            ? "Token stale or app not installed on this repo."
            : status.error}
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <a
            href={appInstallUrl(callbackUrl)}
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1 rounded border border-emerald-800/60 text-emerald-300 hover:bg-emerald-950/40"
          >
            Reinstall the app →
          </a>
          <SignOutButton />
        </div>
        {isAuthErr && (
          <div className="text-[11px] text-neutral-500 max-w-md">
            Reinstall gives a fresh installation on the fork; sign-in-again
            gives a fresh user token. Either fixes the 401.
          </div>
        )}
      </div>
    );
  }

  if (status.installed) {
    return (
      <span className="text-emerald-300 text-xs">
        ✓ App installed (installation #{status.installationId})
      </span>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <a
        href={appInstallUrl(callbackUrl) || status.installUrl}
        target="_blank"
        rel="noreferrer"
        className="text-amber-300 underline text-xs"
      >
        Not installed — install the app on {status.targetRepo} →
      </a>
      <div className="text-[11px] text-neutral-500">
        Grants the console write access to your fork. Once installed, you land back here.
      </div>
    </div>
  );
}

function BusinessDiff({
  cluster,
  repo,
}: {
  cluster: Tenant[];
  repo: Tenant[] | null;
}) {
  const clusterSlugs = new Set(cluster.map((t) => t.slug));
  const repoSlugs = new Set((repo ?? []).map((t) => t.slug));
  const inRepoOnly = (repo ?? []).filter((t) => !clusterSlugs.has(t.slug));
  const inClusterOnly = cluster.filter((t) => !repoSlugs.has(t.slug));
  const inBoth = cluster.filter((t) => repoSlugs.has(t.slug));

  if (repo === null) {
    return (
      <div className="text-xs text-neutral-400">
        Couldn&apos;t read <code>bootstrap/00-namespaces.yaml</code> from the
        write target — sign in or check that the file exists on the fork.
        Cluster currently has {cluster.length} business
        {cluster.length === 1 ? "" : "es"}.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 text-xs">
      <DiffColumn
        title="In repo & cluster"
        items={inBoth.map((t) => t.slug)}
        tone="good"
      />
      <DiffColumn
        title="In repo, not in cluster"
        items={inRepoOnly.map((t) => t.slug)}
        tone="warn"
        hint="Reconnect GitHub to auto-provision these into the cluster."
      />
      <DiffColumn
        title="In cluster, not in repo"
        items={inClusterOnly.map((t) => t.slug)}
        tone="warn"
        hint="Drift — likely a manual kubectl apply that never made it to git."
      />
    </div>
  );
}

function DiffColumn({
  title,
  items,
  tone,
  hint,
}: {
  title: string;
  items: string[];
  tone: "good" | "warn";
  hint?: string;
}) {
  const border =
    tone === "good"
      ? "border-emerald-800/40"
      : items.length > 0
      ? "border-amber-800/50"
      : "border-[color:var(--color-border)]";
  return (
    <div className={"border rounded p-3 " + border}>
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] mb-2">
        {title} · {items.length}
      </div>
      {items.length === 0 ? (
        <div className="text-neutral-500">—</div>
      ) : (
        <ul className="space-y-0.5">
          {items.map((s) => (
            <li key={s}>
              <code>{s}</code>
            </li>
          ))}
        </ul>
      )}
      {hint && items.length > 0 && (
        <div className="mt-2 text-[11px] text-neutral-500">{hint}</div>
      )}
    </div>
  );
}
