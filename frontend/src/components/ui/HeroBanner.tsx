import type { ReactNode } from "react";

export function HeroBanner({
  label,
  text,
  actions,
}: {
  label: string;
  text: string;
  actions?: ReactNode;
}) {
  return (
    <article className="hero">
      <div className="hero-copy">
        <p className="hero-label">{label}</p>
        <p className="hero-text">{text}</p>
      </div>
      {actions}
    </article>
  );
}
