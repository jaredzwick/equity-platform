// Redirect / for now — Overview page has the app list.
// Future: dedicated app detail page with sync-diff, revision history, drift graph.
export default function AppsPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold mb-2">Apps</h1>
      <p className="text-sm text-[color:var(--color-muted)]">
        See Overview for now. Detailed per-app view (sync diff, revision history, drift graph) coming in v0.2.
      </p>
    </div>
  );
}
