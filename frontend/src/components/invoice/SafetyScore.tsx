import { ar } from "../../locales/ar";

export function SafetyScore({ score, issuesCount }: { score: number | null; issuesCount: number }) {
  const value = score ?? 100;
  const tone = value >= 85 ? "alert-ok" : value >= 70 ? "alert-warn" : "alert-error";

  return (
    <article className={`alert ${tone}`}>
      <div className="page-header">
        <div className="page-header-copy">
          <p className="kpi-label">{ar.invoices.safetyScore}</p>
          <p className="kpi-value">
            {value} / 100
          </p>
        </div>
        <p className="card-title">
          {issuesCount > 0 ? `${ar.invoices.issuesFound}: ${issuesCount}` : ar.invoices.noIssues}
        </p>
      </div>
    </article>
  );
}
