import { useEffect, useState } from "react";
import { api, type ProfitReport } from "../../api/client";
import { SummaryCard } from "../../components/reports/ChartCard";
import { PeriodFilter, defaultPeriod, type PeriodValue } from "../../components/reports/PeriodFilter";
import { Alert } from "../../components/ui/Alert";
import { Card } from "../../components/ui/Card";
import { Page } from "../../components/ui/Page";
import { PageHeader } from "../../components/ui/PageHeader";
import { formatMoney, formatRatio } from "../../lib/format";
import { ar } from "../../locales/ar";

export function ProfitReportPage() {
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod);
  const [report, setReport] = useState<ProfitReport | null>(null);
  const [currency, setCurrency] = useState("EUR");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.profitReport(period), api.settings()])
      .then(([nextReport, settings]) => {
        setReport(nextReport);
        setCurrency(settings.currency);
        setError("");
      })
      .catch(() => setError(ar.dashboard.disconnected));
  }, [period]);

  return (
    <Page>
      <PageHeader title={ar.reports.profit} subtitle={ar.reports.profitSubtitle} />
      <PeriodFilter value={period} onChange={setPeriod} />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {report ? (
        <>
          <div className="kpi-grid">
            <SummaryCard label={ar.dashboard.sales} value={formatMoney(report.sales, currency)} />
            <SummaryCard label={ar.reports.cogs} value={formatMoney(report.cogs, currency)} />
            <SummaryCard label={ar.reports.grossProfit} value={formatMoney(report.grossProfit, currency)} />
            <SummaryCard label={ar.reports.expenses} value={formatMoney(report.expenses, currency)} />
            <SummaryCard
              label={ar.reports.netProfit}
              value={formatMoney(report.netProfit, currency)}
              tone={report.netProfit >= 0 ? "ok" : "warn"}
            />
            <SummaryCard label={ar.reports.margin} value={formatRatio(report.marginPercent)} />
          </div>
          <Card title={ar.reports.formula}>
            <p className="muted">{ar.reports.formulaSales}</p>
            <p className="muted">{ar.reports.formulaCogs}</p>
            <p className="muted">{ar.reports.formulaGross}</p>
            <p className="muted">{ar.reports.formulaNet}</p>
            <p className="muted">{ar.reports.formulaMargin}</p>
          </Card>
        </>
      ) : null}
    </Page>
  );
}
