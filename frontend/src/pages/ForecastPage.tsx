import { useEffect, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, type ForecastConfidence, type ForecastResponse } from "../api/client";
import { chartColors } from "../components/reports/ChartCard";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { LoadingPanel } from "../components/ui/LoadingPanel";
import { Page } from "../components/ui/Page";
import { PageHeader } from "../components/ui/PageHeader";
import { formatMoney } from "../lib/format";
import { ar } from "../locales/ar";

const confidenceTone: Record<ForecastConfidence, "ok" | "warn" | "muted"> = {
  HIGH: "ok",
  MEDIUM: "warn",
  LOW: "muted",
};

const confidenceLabel: Record<ForecastConfidence, string> = {
  HIGH: ar.forecast.high,
  MEDIUM: ar.forecast.medium,
  LOW: ar.forecast.low,
};

export function ForecastPage() {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState("EUR");

  useEffect(() => {
    Promise.all([api.forecast(), api.settings()])
      .then(([forecast, settings]) => {
        setData(forecast);
        setCurrency(settings.currency);
      })
      .catch(() => setError(ar.dashboard.disconnected));
  }, []);

  const next = data?.months[0];

  return (
    <Page>
      <PageHeader title={ar.forecast.title} subtitle={ar.forecast.subtitle} />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {!data && !error ? <LoadingPanel label={ar.forecast.loading} /> : null}

      {data && next ? (
        <>
          <article className={next.profit >= 0 ? "hero" : "hero is-loss"}>
            <div className="hero-copy">
              <p className="hero-label">{ar.forecast.nextMonth}</p>
              <p className="hero-value">{formatMoney(next.profit, currency)}</p>
              <p className="hero-text">{next.profit >= 0 ? ar.forecast.gain : ar.forecast.loss}</p>
            </div>
            <div className="hero-meta">
              <Badge tone="muted">{ar.forecast.linear}</Badge>
              <Badge tone={confidenceTone[data.confidence]}>
                {ar.forecast.confidence}: {confidenceLabel[data.confidence]}
              </Badge>
            </div>
          </article>

          <div className="stat-pills">
            <article className="stat-pill">
              <p className="kpi-label">{ar.forecast.historyMonths}</p>
              <p className="card-title">{data.historyMonths}</p>
            </article>
            <article className="stat-pill">
              <p className="kpi-label">{ar.forecast.average}</p>
              <p className="card-title">{formatMoney(data.movingAverage, currency)}</p>
            </article>
            <article className="stat-pill">
              <p className="kpi-label">{ar.forecast.method}</p>
              <p className="card-title">{ar.forecast.linear}</p>
            </article>
          </div>

          <div className="forecast-months">
            {data.months.map((month) => {
              const positive = month.profit >= 0;
              const tone = positive ? "is-ok" : "is-danger";
              return (
                <article key={month.key} className="forecast-month">
                  <p className="forecast-month-name">{ar.forecast.monthOutlook}</p>
                  <h3 className="card-title">{month.label}</h3>
                  <p className={`forecast-month-profit ${tone}`}>{formatMoney(month.profit, currency)}</p>
                  <p className={`forecast-month-status ${tone}`}>
                    {positive ? ar.forecast.gain : ar.forecast.loss}
                  </p>
                  <div className="forecast-meta">
                    <div className="forecast-meta-row is-sales">
                      <span className="muted">{ar.forecast.nextSales}</span>
                      <span className="card-title">{formatMoney(month.sales, currency)}</span>
                    </div>
                    <div className="forecast-meta-row is-expenses">
                      <span className="muted">{ar.forecast.nextExpenses}</span>
                      <span className="card-title">{formatMoney(month.expenses, currency)}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <article className="card">
            <h3 className="card-title">{ar.forecast.chartTitle}</h3>
            <div className="chart-box-lg" dir="ltr">
              <ResponsiveContainer>
                <LineChart data={data.chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6dfd4" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="actual" name={ar.forecast.actual} stroke={chartColors.profit} strokeWidth={3} dot />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    name={ar.forecast.predicted}
                    stroke={chartColors.forecast}
                    strokeWidth={3}
                    strokeDasharray="6 4"
                    dot
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <Card title={ar.forecast.explanation}>
            <p className="muted preserve-lines">{data.explanation}</p>
          </Card>
        </>
      ) : null}
    </Page>
  );
}
