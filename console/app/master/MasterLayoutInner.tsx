"use client";

import { usePathname } from "next/navigation";
import MasterTabs from "./MasterTabs";

export default function MasterLayoutInner({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const onDeck = path === "/master";
  return (
    <div>
      {!onDeck && (
        <header className="mb-6 border-b border-[color:var(--color-border)] pb-4">
          <MasterTabs />
        </header>
      )}
      {children}
    </div>
  );
}
