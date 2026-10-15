"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// useToast — the one toast primitive on lamboapp. Replaces (not queues) on
// consecutive fires because the only consumer today is Share → Copy link,
// where double-tapping should swap the latest status, not stack three
// identical messages. Introduce a queue the day a second-consumer needs it.
//
// Provider lives at app/layout.tsx so useToast() works anywhere under the
// tree. If someone calls useToast() outside a provider, the hook returns a
// no-op `show` so component tests don't need to mount a provider.

export type ToastKind = "success" | "error";
export type ToastInput = { text: string; kind?: ToastKind };

type ToastContextValue = {
  current: InternalToast | null;
  show: (input: ToastInput) => void;
};

type InternalToast = ToastInput & { id: number };

const NOOP_CTX: ToastContextValue = {
  current: null,
  show: () => {
    // intentionally empty — reached when a consumer forgets to mount the
    // provider. Prefer a silent no-op over a crash so share actions still
    // navigate; the missing toast is noticeable in dev but not blocking.
  },
};

const ToastContext = createContext<ToastContextValue>(NOOP_CTX);

export function useToast() {
  return useContext(ToastContext);
}

// SUCCESS_MS — long enough to read "Link copied", short enough to not stack
// visually when the user copies twice in a row.
const SUCCESS_MS = 2500;
// ERROR_MS — error toasts carry recovery instructions ("select the URL
// manually"); give them more time.
const ERROR_MS = 4000;

type ProviderProps = { children: React.ReactNode };

export function ToastProvider({ children }: ProviderProps) {
  const [current, setCurrent] = useState<InternalToast | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextIdRef = useRef(1);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      clearTimer();
      const toast: InternalToast = {
        id: nextIdRef.current++,
        text: input.text,
        kind: input.kind ?? "success",
      };
      setCurrent(toast);
      const dur = toast.kind === "error" ? ERROR_MS : SUCCESS_MS;
      timerRef.current = setTimeout(() => {
        setCurrent((cur) => (cur && cur.id === toast.id ? null : cur));
        timerRef.current = null;
      }, dur);
    },
    [clearTimer],
  );

  useEffect(() => clearTimer, [clearTimer]);

  return (
    <ToastContext.Provider value={{ current, show }}>
      {children}
    </ToastContext.Provider>
  );
}
