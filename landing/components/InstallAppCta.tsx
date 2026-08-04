"use client";

import { useEffect, useState } from "react";

type State =
  | { kind: "checking" }
  | { kind: "installed" }
  | { kind: "not_installed"; installUrl: string; targetRepo: string }
  | { kind: "error"; message: string };

// Polls /api/auth/install-status once on mount and again after focus (so
// coming back from the GitHub install screen re-checks without a full
// reload).
export default function InstallAppCta() {
  const [state, setState] = useState<State>({ kind: "checking" });

  const check = () => {
    fetch("/api/auth/install-status", { cache: "no-store" })
      .then((r) => r.json())
      .then(
        (d: {
          installed?: boolean;
          installUrl?: string;
          targetRepo?: string;
          error?: string;
        }) => {
          if (d.error) {
            setState({ kind: "error", message: d.error });
          } else if (d.installed) {
            setState({ kind: "installed" });
          } else {
            setState({
              kind: "not_installed",
              installUrl: d.installUrl ?? "https://github.com/apps",
              targetRepo: d.targetRepo ?? "",
            });
          }
        },
      )
      .catch((e) =>
        setState({ kind: "error", message: e instanceof Error ? e.message : String(e) }),
      );
  };

  useEffect(() => {
    check();
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  if (state.kind === "checking") {
    return (
      <div className="rounded-lg border border-[color:var(--color-border)] p-4 text-sm text-[color:var(--color-muted)]">
        Checking whether the equity-console App is installed on your fork…
      </div>
    );
  }

  if (state.kind === "installed") {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-400 flex items-center gap-2">
        <span aria-hidden>✓</span>
        <span>equity-console App is installed on your fork. Ready to run <code className="text-emerald-300">./local/up.sh</code>.</span>
      </div>
    );
  }

  if (state.kind === "not_installed") {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-5">
        <h3 className="font-medium">Install the equity-console App on your fork</h3>
        <p className="mt-2 text-sm text-[color:var(--color-muted)]">
          The local console writes YAML to your fork over the GitHub API. Without the App
          installed, those writes fail with 404. This is a one-click, one-time step.
        </p>
        <a
          href={state.installUrl}
          className="mt-4 inline-flex items-center rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:opacity-90"
          target="_blank"
          rel="noreferrer"
        >
          Install App on {state.targetRepo || "your fork"} &rarr;
        </a>
        <p className="mt-2 text-xs text-[color:var(--color-muted)]">
          After installing, this chip refreshes automatically when you switch back to this tab.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
      Could not check install status: {state.message}
    </div>
  );
}
