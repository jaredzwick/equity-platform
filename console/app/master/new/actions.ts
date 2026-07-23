"use server";

import { core } from "@/lib/k8s";
import { getFileSha, isConfigured, putFile } from "@/lib/github";
import { discoverTenants } from "@/lib/tenants";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const BOOTSTRAP_PATH = "bootstrap/00-namespaces.yaml";

function validSlug(s: string): boolean {
  return /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(s);
}

// Append a namespace block to the existing bootstrap yaml. The file is
// a multi-document yaml stream (--- separated); we append one more doc.
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
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const namespace = String(formData.get("namespace") ?? "").trim() || `${slug}-prod`;

  const backTo = "/master/new";

  if (!validSlug(slug)) {
    redirect(`${backTo}?error=${encodeURIComponent("Slug must be kebab-case (a-z, 0-9, dashes).")}`);
  }
  if (!name) {
    redirect(`${backTo}?error=${encodeURIComponent("Display name required.")}`);
  }
  if (!validSlug(namespace)) {
    redirect(`${backTo}?error=${encodeURIComponent("Namespace must be kebab-case.")}`);
  }
  if (!isConfigured()) {
    redirect(`${backTo}?error=${encodeURIComponent("GITHUB_TOKEN + GITHUB_REPO must be set.")}`);
  }

  // Bail if slug already exists.
  const existing = await discoverTenants().catch(() => []);
  if (existing.some((t) => t.slug === slug)) {
    redirect(`${backTo}?error=${encodeURIComponent(`A business with slug "${slug}" already exists.`)}`);
  }

  // 1) Append to bootstrap/00-namespaces.yaml via GitHub Contents API.
  //    This is the CANONICAL source. Git commit = versioned + revertable.
  try {
    const sha = await getFileSha(BOOTSTRAP_PATH);
    if (!sha) {
      redirect(`${backTo}?error=${encodeURIComponent(`Could not find ${BOOTSTRAP_PATH} in the repo.`)}`);
    }
    // Fetch current contents so we can append.
    const owner = process.env.GITHUB_REPO!.split("/")[0];
    const repo = process.env.GITHUB_REPO!.split("/")[1];
    const branch = process.env.GITHUB_BRANCH ?? "main";
    const raw = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${BOOTSTRAP_PATH}`,
      { cache: "no-store", headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } },
    );
    if (!raw.ok) {
      redirect(`${backTo}?error=${encodeURIComponent(`Could not read ${BOOTSTRAP_PATH}: HTTP ${raw.status}`)}`);
    }
    const current = await raw.text();
    const appended = current + (current.endsWith("\n") ? "" : "\n") + renderNamespace(slug, name, namespace);

    await putFile({
      path: BOOTSTRAP_PATH,
      content: appended,
      message: `feat(agency): add ${name} (${slug}) business`,
      sha: sha!,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirect(`${backTo}?error=${encodeURIComponent(`GitHub write failed: ${msg}`)}`);
  }

  // 2) Also apply the namespace directly to the current cluster so the
  //    business shows up immediately (bootstrap yaml is not under ArgoCD
  //    watch today — see roadmap). Idempotent: if namespace already
  //    exists we swallow the 409.
  try {
    await core().createNamespace({
      metadata: {
        name: namespace,
        labels: {
          "equity.io/tenant": slug,
          "equity.io/tenant-name": name,
        },
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("already exists")) {
      // Commit succeeded but apply failed. Still redirect to master —
      // next `./local/up.sh` will pick it up from the commit.
      redirect(`/master?warn=${encodeURIComponent(`Committed but cluster-apply failed: ${msg}. Re-run ./local/up.sh.`)}`);
    }
  }

  revalidatePath("/master");
  revalidatePath("/", "layout"); // sidebar re-fetches
  redirect(`/${slug}?created=1`);
}
