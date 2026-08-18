import type { ReactNode } from "react";

export function Page({ children }: { children: ReactNode }) {
  return <section className="page">{children}</section>;
}
