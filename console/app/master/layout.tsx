import MasterLayoutInner from "./MasterLayoutInner";

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  return <MasterLayoutInner>{children}</MasterLayoutInner>;
}
