import MasterTabs from "./MasterTabs";

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header className="mb-6 border-b border-[color:var(--color-border)] pb-4">
        <MasterTabs />
      </header>
      {children}
    </div>
  );
}
