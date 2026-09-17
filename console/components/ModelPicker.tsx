"use client";

import { useEffect, useState } from "react";

// Keep in sync with the ALLOWED_MODELS set in app/api/chat/route.ts.
// Ordered by user-visible fastest → smartest so the picker default lands on
// the fast option unless the user opts in to Opus.
export const CHAT_MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", hint: "instant" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6", hint: "fast" },
  { id: "claude-opus-4-7", label: "Opus 4.7", hint: "smart" },
] as const;

export type ChatModelId = (typeof CHAT_MODELS)[number]["id"];

const DEFAULT_MODEL: ChatModelId = "claude-sonnet-4-6";
const STORAGE_KEY = "equity.chat.model";

function isChatModel(v: string): v is ChatModelId {
  return CHAT_MODELS.some((m) => m.id === v);
}

// Persist the operator's model choice across page loads. Falls back to the
// default before hydration completes so we never emit a mismatched SSR/CSR
// value. Returns the current choice + a setter that also writes localStorage.
export function useChatModel() {
  const [model, setModelState] = useState<ChatModelId>(DEFAULT_MODEL);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && isChatModel(saved)) setModelState(saved);
  }, []);
  function setModel(next: ChatModelId) {
    setModelState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }
  return { model, setModel };
}

type Props = {
  value: ChatModelId;
  onChange: (v: ChatModelId) => void;
  disabled?: boolean;
};

export function ModelPicker({ value, onChange, disabled }: Props) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        if (isChatModel(v)) onChange(v);
      }}
      className="text-xs bg-transparent border border-[color:var(--color-border)] rounded px-2 py-1 hover:border-emerald-700/60 focus:outline-none focus:border-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
      title="Chat model"
    >
      {CHAT_MODELS.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label} · {m.hint}
        </option>
      ))}
    </select>
  );
}
