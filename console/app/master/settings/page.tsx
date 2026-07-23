import { isAuthenticated, repoUrl } from "@/lib/github";
import { AGENCY_PATH, loadAgency } from "@/lib/agency";
import AgencyEditor from "./AgencyEditor";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

export default async function AgencySettingsPage({ searchParams }: Props) {
  const { saved, error } = await searchParams;
  const configured = await isAuthenticated();
  const cfg = configured ? await loadAgency().catch(() => null) : null;
  const configuredRepoUrl = configured ? await repoUrl() : null;

  return (
    <div className="max-w-4xl">
      <div className="mb-4 text-sm text-[color:var(--color-muted)]">
        Master org config — shared across every business.{" "}
        Saved as{" "}
        {configuredRepoUrl ? (
          <a
            href={`${configuredRepoUrl}/blob/main/${AGENCY_PATH}`}
            className="underline text-emerald-400"
            target="_blank"
            rel="noreferrer"
          >
            <code className="text-xs">{AGENCY_PATH}</code>
          </a>
        ) : (
          <code className="text-xs text-neutral-400">{AGENCY_PATH}</code>
        )}
        {" "}in the platform repo. Feeds every tenant provisioning flow.
      </div>

      {!configured && (
        <div className="mb-6 p-4 border border-amber-500/40 rounded-lg bg-amber-950/80 text-sm">
          <div className="font-semibold text-amber-200 mb-1">Sign in with GitHub to edit</div>
          <div className="text-neutral-300">
            The form below is read-only until you sign in. Session token needed to write to git.
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 border border-red-500/40 rounded-lg bg-red-950/80 text-sm text-red-200">
          {error}
        </div>
      )}
      {saved && (
        <div className="mb-6 p-4 border border-emerald-500/40 rounded-lg bg-emerald-950/80 text-sm text-emerald-200">
          Saved. Committed to git.
        </div>
      )}

      <AgencyEditor
        initialConfig={cfg ?? {}}
        hasExisting={!!cfg}
        configured={configured}
      />
    </div>
  );
}
