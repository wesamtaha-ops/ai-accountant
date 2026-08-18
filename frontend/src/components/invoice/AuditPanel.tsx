import type { AiReview, AuditResult } from "../../api/client";
import { formatMoney } from "../../lib/format";
import { ar } from "../../locales/ar";

const typeLabel: Record<AuditResult["type"], string> = {
  CALCULATION_ERROR: ar.invoices.calcError,
  PRICE_DEVIATION: ar.invoices.priceWarning,
  DUPLICATE: ar.invoices.duplicateWarning,
  OTHER: ar.invoices.audit,
};

export function AuditPanel({
  results,
  review,
  currency,
}: {
  results: AuditResult[];
  review: AiReview | null;
  currency: string;
}) {
  if (results.length === 0 && !review) {
    return null;
  }

  return (
    <div className="list-stack">
      {results.length > 0 ? (
        <article className="card">
          {results.map((item) => (
            <div key={item.id} className={item.severity === "ERROR" ? "alert alert-error" : "alert alert-warn"}>
              <p className="card-title">{typeLabel[item.type]}</p>
              <p>{item.message}</p>
              {item.invoiceValue != null && item.expectedValue != null ? (
                <p className="muted">
                  {ar.invoices.invoiceValue}: {formatMoney(item.invoiceValue, currency)} · {ar.invoices.correctValue}:{" "}
                  {formatMoney(item.expectedValue, currency)}
                </p>
              ) : null}
            </div>
          ))}
        </article>
      ) : null}

      {review ? (
        <article className="card">
          <h3 className="card-title">{ar.invoices.aiReview}</h3>
          <p className="preserve-lines">{review.summary}</p>
          <p className="card-title">{ar.invoices.recommendation}</p>
          <p>{review.recommendation}</p>
        </article>
      ) : null}
    </div>
  );
}
