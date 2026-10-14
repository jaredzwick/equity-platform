import { notFound } from "next/navigation";
import { resolveTenant, MASTER_SLUG } from "@/lib/tenants";
import { listObjects, bucketForTenant, type ListEntry } from "@/lib/s3";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ tenant: string }> };

export default async function ArtifactsPage({ params }: Props) {
  const { tenant: slug } = await params;
  if (slug === MASTER_SLUG) notFound();
  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  let entries: ListEntry[] = [];
  let error: string | null = null;
  try {
    entries = await listObjects(slug, "", 500);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const bucket = bucketForTenant(slug);
  const totalBytes = entries.reduce((acc, e) => acc + e.size, 0);

  return (
    <div className="max-w-6xl">
      <div className="mb-4 text-sm text-[color:var(--color-muted)]">
        Objects agents and workflows have written to the tenant's S3 bucket.
        Stored at <code className="text-neutral-400">{bucket}</code> on
        MinIO, 90-day default lifecycle. Click any row to open the file.
      </div>

      {error && (
        <div className="mb-4 p-3 border border-red-500/40 rounded-lg bg-red-950/80 text-sm text-red-200">
          Could not list artifacts: {error}
          <div className="mt-1 text-xs opacity-80">
            MinIO env (S3_ENDPOINT / S3_ROOT_USER / S3_ROOT_PASSWORD) may be unset or
            the bucket hasn't been provisioned yet. New businesses get it automatically;
            older ones may need a re-reconcile.
          </div>
        </div>
      )}

      {!error && entries.length === 0 && (
        <div className="border border-dashed border-[color:var(--color-border)] rounded-lg p-8 text-center text-sm text-[color:var(--color-muted)]">
          No artifacts yet. Agents write here via the <code>s3_put</code> MCP tool —
          reports, screenshots, exports, generated images. They'll show up here with a
          link you can share or forward.
        </div>
      )}

      {entries.length > 0 && (
        <>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--color-muted)]">
              Artifacts
            </h2>
            <span className="text-[10px] text-[color:var(--color-muted)] font-mono">
              {entries.length} object{entries.length === 1 ? "" : "s"} · {formatSize(totalBytes)}
            </span>
          </div>
          <div className="overflow-x-auto border border-[color:var(--color-border)] rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
                <tr>
                  <th className="text-left px-3 py-2 font-normal">Key</th>
                  <th className="text-right px-3 py-2 font-normal">Size</th>
                  <th className="text-right px-3 py-2 font-normal">Modified</th>
                </tr>
              </thead>
              <tbody>
                {entries
                  .slice()
                  .sort((a, b) => +b.lastModified - +a.lastModified)
                  .map((e) => (
                    <tr
                      key={e.key}
                      className="border-t border-[color:var(--color-border)] hover:bg-white/[0.02]"
                    >
                      <td className="px-3 py-2 font-mono text-xs">
                        <a
                          href={`/api/${slug}/artifacts/${encodeKey(e.key)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                        >
                          {e.key}
                        </a>
                      </td>
                      <td className="text-right px-3 py-2 tabular-nums text-xs">
                        {formatSize(e.size)}
                      </td>
                      <td className="text-right px-3 py-2 font-mono text-xs">
                        {e.lastModified.toISOString().slice(0, 16).replace("T", " ")}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function encodeKey(key: string): string {
  // Preserve slash separators so the Next catch-all route resolves cleanly;
  // encode each segment to escape spaces, unicode, special chars.
  return key.split("/").map(encodeURIComponent).join("/");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
