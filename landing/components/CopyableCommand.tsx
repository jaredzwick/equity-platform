"use client";

import { useState } from "react";

export default function CopyableCommand({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be blocked; fall back silently.
    }
  };
  return (
    <div className="flex items-center gap-2 rounded-md border border-[color:var(--color-border)] bg-white/[0.02] px-3 py-2 font-mono text-sm">
      <span className="text-[color:var(--color-muted)] select-none">$</span>
      <code className="flex-1 overflow-x-auto whitespace-nowrap">{cmd}</code>
      <button
        onClick={onCopy}
        className="text-xs text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)] rounded px-2 py-1"
        aria-label={`Copy: ${cmd}`}
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}
