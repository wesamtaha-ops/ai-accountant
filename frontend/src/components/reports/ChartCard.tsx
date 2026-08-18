import type { ReactNode } from "react";

export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="card">
      <h3 className="card-title">{title}</h3>
      <div className="chart-box" dir="ltr">
        {children}
      </div>
    </article>
  );
}

export function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn" | "muted";
}) {
  const extra = tone === "default" ? "" : ` is-${tone}`;

  return (
    <article className={`kpi${extra}`}>
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
    </article>
  );
}

export const chartColors = {
  sales: "#0f766e",
  expenses: "#b45309",
  profit: "#1d4ed8",
  receipts: "#047857",
  payments: "#be123c",
  products: "#0f5f59",
  forecast: "#7c3aed",
};
