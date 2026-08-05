"use server";

import { core } from "@/lib/k8s";
import { canWriteToRepo, getFile, putFile } from "@/lib/github";
import { discoverTenants } from "@/lib/tenants";
import { ensureTenantEmailDb, isEmailDbConfigured } from "@/lib/email-db";
import { ensureTenantStream } from "@/lib/nats-streams";
import { parseBusinessInput } from "@/lib/business-url";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const BOOTSTRAP_PATH = "bootstrap/00-namespaces.yaml";
const BACK_TO = "/master/new";

function isRedirect(e: unknown): boolean {
  return typeof e === "object" && e !== null && "digest" in e
    && typeof (e as { digest: unknown }).digest === "string"
    && (e as { digest: string }).digest.startsWith("NEXT_REDIRECT");
}

// Sanitize whatever internal errors bubble up so the UI never leaks URLs,
// tokens, or JSON blobs. Full error is logged server-side; the user sees
// a short, actionable message.
function friendlyError(kind: "github" | "cluster", raw: unknown): string {
  const msg = raw instanceof Error ? raw.message : String(raw);
  console.error(`[master/new] ${kind} error:`, msg);
  if (kind === "github") {
    if (/403|not accessible|permission/i.test(msg)) {
      return "GitHub backup couldn't write. Reinstall the equity-console GitHub app on your repo, or continue without git backup by disabling backup on the GitHub tab.";
    }
    if (/404|not found/i.test(msg)) {
      return "GitHub backup couldn't find the platform repo's bootstrap file. Check that the backup target is a fork of the platform repo.";
    }
    return "GitHub backup write failed. Check the GitHub tab and try again.";
  }
  if (/forbidden|unauthorized/i.test(msg)) {
    return "The console can't create namespaces in this cluster. Check RBAC on the console service account.";
  }
  return "Couldn't apply the namespace to the cluster. Try again in a moment.";
}

function renderNamespace(slug: string, name: string, ns: string): string {
  return `---
apiVersion: v1
kind: Namespace
metadata:
  name: ${ns}
  labels:
    equity.io/tenant: ${slug}
    equity.io/tenant-name: ${name}
`;
}

export async function provisionBusinessFromForm(formData: FormData): Promise<void> {
  const raw = String(formData.get("input") ?? "");
  const parsed = parseBusinessInput(raw);
  if (!parsed.ok) {
    redirect(`${BACK_TO}?error=${encodeURIComponent(parsed.reason)}`);
  }
  const { slug, name, namespace } = parsed;

  const existing = await discoverTenants().catch(() => []);
  if (existing.some((t) => t.slug === slug)) {
    redirect(
      `${BACK_TO}?error=${encodeURIComponent(
        `A business with slug "${slug}" already exists. Pick a different URL or name.`,
      )}`,
    );
  }

  // Check whether GitHub-backed provisioning is available AND actually
  // works. If it doesn't, silently fall back to cluster-only — the user
  // shouldn't see the internal repo URL or a raw 403.
  const commitToGit = await canWriteToRepo();

  // Step 1 (optional): commit the namespace definition to git.
  //   Only attempt if we've verified we can write. If it fails partway
  //   through (network flake, ref moved), we log server-side and downgrade
  //   to cluster-only — the tenant still lands, but without git backup.
  //   We do not surface the raw GitHub URL or 403 to the user.
  let gitCommitFailed = false;
  if (commitToGit) {
    try {
      const bootstrap = await getFile(BOOTSTRAP_PATH);
      if (!bootstrap) {
        console.warn(`[master/new] ${BOOTSTRAP_PATH} not found in target repo; skipping git commit`);
        gitCommitFailed = true;
      } else {
        const appended = bootstrap.content
          + (bootstrap.content.endsWith("\n") ? "" : "\n")
          + renderNamespace(slug, name, namespace);
        await putFile({
          path: BOOTSTRAP_PATH,
          content: appended,
          message: `feat(agency): add ${name} (${slug}) business`,
          sha: bootstrap.sha,
        });
      }
    } catch (e) {
      if (isRedirect(e)) throw e;
      console.error(`[master/new] git commit failed for ${slug}:`, e);
      gitCommitFailed = true;
    }
  }

  // Step 2: apply the namespace to the live cluster. This is the "shows
  //   up in the sidebar immediately" path. If this fails, the tenant is
  //   effectively not created — surface a sanitized error.
  try {
    await core().createNamespace({
      body: {
        metadata: {
          name: namespace,
          labels: {
            "equity.io/tenant": slug,
            "equity.io/tenant-name": name,
          },
        },
      },
    });
  } catch (e) {
    if (isRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("already exists")) {
      redirect(
        `${BACK_TO}?error=${encodeURIComponent(friendlyError("cluster", e))}`,
      );
    }
  }

  // Step 3: best-effort email DB provisioning.
  if (isEmailDbConfigured()) {
    try {
      await ensureTenantEmailDb(slug);
    } catch (e) {
      console.error(`[email-db] auto-provision failed for ${slug}:`, e);
    }
  }

  // Step 4: best-effort NATS stream provisioning. Surface a warn on the
  //   tenant landing page if this failed (since it blocks the events tab).
  const streamResult = await ensureTenantStream(slug);
  const warnings: string[] = [];
  if (!streamResult.ok) {
    console.error(`[nats] auto-provision failed for ${slug}:`, streamResult.error);
    warnings.push("NATS stream not created. Retry from the Events tab.");
  }
  if (commitToGit && gitCommitFailed) {
    warnings.push("Cluster ready; git backup skipped. Retry from the GitHub tab.");
  }

  revalidatePath("/master");
  revalidatePath("/", "layout");

  const qs = new URLSearchParams({ created: "1" });
  if (warnings.length) qs.set("warn", warnings.join(" "));
  redirect(`/${slug}?${qs.toString()}`);
}
