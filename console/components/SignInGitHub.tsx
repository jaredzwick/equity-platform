"use client";

import { useEffect, useState } from "react";

type InstallStatus =
  | { checking: true }
  | { checking: false; installed: true }
  | { checking: false; installed: false; installUrl: string; targetRepo: string }
  | { checking: false; error: string };

function AuthedChip({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [install, setInstall] = useState<InstallStatus>({ checking: true });

  useEffect(() => {
    fetch("/api/auth/install-status")
      .then((r) => r.json())
      .then((data: {
        installed?: boolean;
        installUrl?: string;
        targetRepo?: string;
        error?: string;
      }) => {
        if (data.error) {
          setInstall({ checking: false, error: data.error });
        } else if (data.installed) {
          setInstall({ checking: false, installed: true });
        } else {
          setInstall({
            checking: false,
            installed: false,
            installUrl: data.installUrl!,
            targetRepo: data.targetRepo!,
          });
        }
      })
      .catch((e) =>
        setInstall({ checking: false, error: e instanceof Error ? e.message : String(e) }),
      );
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 group">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt={user.login} className="w-5 h-5 rounded-full" />
        ) : null}
        <span className="text-xs flex-1 truncate">{user.login}</span>
        <button
          onClick={onSignOut}
          className="text-[10px] text-[color:var(--color-muted)] group-hover:text-[color:var(--color-fg)]"
          title="Sign out"
        >
          ✕
        </button>
      </div>

      {!install.checking && "installed" in install && !install.installed && (
        <a
          href={install.installUrl}
          target="_blank"
          rel="noreferrer"
          className="block px-3 py-2 rounded border border-amber-500/40 bg-amber-950/40 text-[11px] hover:bg-amber-950/60"
        >
          <div className="text-amber-200 font-medium">Install app on your repo</div>
          <div className="text-neutral-400 mt-0.5">
            Writes to <code className="text-neutral-300">{install.targetRepo}</code> need the
            equity-console app installed there.
          </div>
        </a>
      )}
      {!install.checking && "installed" in install && install.installed && (
        <div className="px-3 py-1 text-[10px] text-emerald-400/70">
          ✓ App installed on your repo
        </div>
      )}
    </div>
  );
}

type User = { login: string; avatarUrl: string };

// Sign-in states:
//  - unknown: still loading current auth
//  - anonymous: not signed in
//  - starting: kicking off device flow
//  - waiting: user needs to enter code
//  - polling: waiting for user to approve
//  - authed: signed in, showing user chip
//  - error: something went wrong

type Phase =
  | { kind: "unknown" }
  | { kind: "anonymous" }
  | { kind: "starting" }
  | { kind: "waiting"; userCode: string; verificationUri: string; interval: number; expiresAt: number }
  | { kind: "polling"; userCode: string; verificationUri: string; interval: number; expiresAt: number }
  | { kind: "authed"; user: User }
  | { kind: "error"; message: string };

export default function SignInGitHub() {
  const [phase, setPhase] = useState<Phase>({ kind: "unknown" });

  // On mount, check if we're already signed in.
  useEffect(() => {
    fetch("/api/auth/user")
      .then(async (r) => (r.ok ? (r.json() as Promise<User & { authenticated: true }>) : null))
      .then((data) => {
        if (data?.authenticated) setPhase({ kind: "authed", user: { login: data.login, avatarUrl: data.avatarUrl } });
        else setPhase({ kind: "anonymous" });
      })
      .catch(() => setPhase({ kind: "anonymous" }));
  }, []);

  // Poll the device flow when in polling state.
  useEffect(() => {
    if (phase.kind !== "polling") return;
    const timer = setTimeout(async () => {
      if (Date.now() > phase.expiresAt) {
        setPhase({ kind: "error", message: "Code expired. Try again." });
        return;
      }
      try {
        const res = await fetch("/api/auth/poll", { method: "POST" });
        const data = (await res.json()) as
          | { status: "success"; login: string }
          | { status: "pending" | "slow_down" | "denied" | "expired" | "error"; error?: string; interval?: number };
        if (data.status === "success") {
          const user = await fetch("/api/auth/user").then((r) => r.json());
          setPhase({ kind: "authed", user: { login: user.login, avatarUrl: user.avatarUrl } });
          // Refresh page so Server Components pick up the new session.
          setTimeout(() => window.location.reload(), 400);
          return;
        }
        if (data.status === "pending") {
          setPhase({ ...phase }); // trigger next poll
          return;
        }
        if (data.status === "slow_down") {
          setPhase({ ...phase, interval: data.interval ?? phase.interval + 5 });
          return;
        }
        setPhase({ kind: "error", message: data.error ?? data.status });
      } catch (e) {
        setPhase({ kind: "error", message: e instanceof Error ? e.message : String(e) });
      }
    }, phase.interval * 1000);
    return () => clearTimeout(timer);
  }, [phase]);

  async function start() {
    setPhase({ kind: "starting" });
    try {
      const res = await fetch("/api/auth/device", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed to start");
      const data = (await res.json()) as {
        user_code: string;
        verification_uri: string;
        interval: number;
        expires_in: number;
      };
      const expiresAt = Date.now() + data.expires_in * 1000;
      setPhase({
        kind: "waiting",
        userCode: data.user_code,
        verificationUri: data.verification_uri,
        interval: data.interval,
        expiresAt,
      });
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  function openAndPoll() {
    if (phase.kind !== "waiting") return;
    // Copy code to clipboard so the user can paste on the device page.
    navigator.clipboard.writeText(phase.userCode).catch(() => {});
    window.open(phase.verificationUri, "_blank", "noopener,noreferrer");
    setPhase({ ...phase, kind: "polling" });
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setPhase({ kind: "anonymous" });
    window.location.reload();
  }

  if (phase.kind === "unknown") return <div className="text-xs text-[color:var(--color-muted)]">…</div>;

  if (phase.kind === "authed") {
    return <AuthedChip user={phase.user} onSignOut={signOut} />;
  }

  if (phase.kind === "waiting" || phase.kind === "polling") {
    const timeLeft = Math.max(0, Math.ceil((phase.expiresAt - Date.now()) / 60000));
    return (
      <div className="px-2 py-2 rounded border border-[color:var(--color-border)] text-xs space-y-2">
        <div>
          Enter this code at <span className="text-emerald-400">github.com/login/device</span>:
        </div>
        <div className="font-mono text-lg tracking-widest text-center py-1 bg-white/5 rounded select-all">
          {phase.userCode}
        </div>
        {phase.kind === "waiting" ? (
          <button
            onClick={openAndPoll}
            className="w-full px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 font-medium"
          >
            Open GitHub + copy code
          </button>
        ) : (
          <div className="text-[color:var(--color-muted)] text-center italic">
            Waiting for approval… ({timeLeft}m left)
          </div>
        )}
        <button
          onClick={() => setPhase({ kind: "anonymous" })}
          className="w-full text-[10px] text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (phase.kind === "error") {
    return (
      <div className="px-2 py-2 rounded border border-red-900 bg-red-950/40 text-xs space-y-2">
        <div className="text-red-300">Sign-in failed:</div>
        <div className="text-neutral-300 break-words">{phase.message}</div>
        <button
          onClick={() => setPhase({ kind: "anonymous" })}
          className="w-full px-3 py-1.5 rounded border border-[color:var(--color-border)] hover:bg-white/5"
        >
          Try again
        </button>
      </div>
    );
  }

  // anonymous or starting
  return (
    <button
      onClick={start}
      disabled={phase.kind === "starting"}
      className="w-full px-3 py-2 rounded border border-[color:var(--color-border)] hover:bg-white/5 text-xs flex items-center justify-center gap-2 disabled:opacity-60"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.3-3.3-.1-.3-.6-1.6.1-3.3 0 0 1-.3 3.3 1.3a11.5 11.5 0 0 1 6 0c2.3-1.6 3.3-1.3 3.3-1.3.7 1.7.2 3 .1 3.3.8.9 1.3 2 1.3 3.3 0 4.7-2.9 5.7-5.6 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z"/>
      </svg>
      {phase.kind === "starting" ? "Starting…" : "Sign in with GitHub"}
    </button>
  );
}
