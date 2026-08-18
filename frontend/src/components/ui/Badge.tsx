import type { ReactNode } from "react";

type BadgeProps = {
  tone?: "ok" | "warn" | "danger" | "muted";
  children: ReactNode;
};

const tones = {
  ok: "badge-ok",
  warn: "badge-warn",
  danger: "badge-danger",
  muted: "badge-muted",
};

export function Badge({ tone = "muted", children }: BadgeProps) {
  return <span className={`badge ${tones[tone]}`}>{children}</span>;
}
