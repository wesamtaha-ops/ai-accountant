import type { ReactNode } from "react";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <article className="card">
      {title ? <h3 className="card-title">{title}</h3> : null}
      {children}
    </article>
  );
}
