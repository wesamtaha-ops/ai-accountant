import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type DashboardReport, type InvoiceSummary } from "../api/client";
import { InvoiceStatusBadge } from "../components/invoice/InvoiceStatusBadge";
import { ChartCard, SummaryCard, chartColors } from "../components/reports/ChartCard";
import { PeriodFilter, defaultPeriod, type PeriodValue } from "../components/reports/PeriodFilter";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Page } from "../components/ui/Page";
import { PageHeader } from "../components/ui/PageHeader";
import { formatMoney, formatNumber, formatRatio } from "../lib/format";
import { ar } from "../locales/ar";

export function DashboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod);
  const [data, setData] = useState<DashboardReport | null>(null);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.health(), api.dashboard(period), api.invoices()])
      .then(([health, dashboard, nextInvoices]) => {
        setConnected(health.ok);
        setData(dashboard);
        setInvoices(nextInvoices.slice(0, 8));
        setError("");
      })
      .catch(() => {
        setError(ar.dashboard.disconnected);
      });
  }, [period]);

  const currency = data?.currency ?? "EUR";

  return (
    <Page>
      <PageHeader
        eyebrow={data?.companyName || ar.companyFallback}
        title={ar.dashboard.title}
        subtitle={ar.dashboard.subtitle}
        actions={<Button onClick={() => navigate("/invoices/upload")}>{ar.dashboard.uploadInvoice}</Button>}
      />

      <div className="toolbar">
        <Badge tone={connected ? "ok" : "danger"}>
          {connected ? ar.dashboard.connected : ar.dashboard.disconnected}
        </Badge>
        {data ? <Badge tone="ok">{ar.dashboard.seedReady}</Badge> : null}
      </div>

      <PeriodFilter value={period} onChange={setPeriod} />

      {error ? <Alert tone="error">{error}</Alert> : null}

      {data ? (
        <>
          <div className="list-stack">
            <p className="page-eyebrow">{ar.dashboard.primaryKpis}</p>
            <div className="kpi-grid">
              <SummaryCard label={ar.dashboard.sales} value={formatMoney(data.cards.sales, currency)} />
              <SummaryCard label={ar.dashboard.purchases} value={formatMoney(data.cards.purchases, currency)} />
              <SummaryCard
                label={ar.dashboard.netProfit}
                value={formatMoney(data.cards.netProfit, currency)}
                tone={data.cards.netProfit >= 0 ? "ok" : "warn"}
              />
              <SummaryCard label={ar.dashboard.cashBalance} value={formatMoney(data.cards.cashBalance, currency)} />
            </div>
          </div>

          <div className="list-stack">
            <p className="page-eyebrow">{ar.dashboard.moreKpis}</p>
            <div className="kpi-grid">
              <SummaryCard label={ar.dashboard.expenses} value={formatMoney(data.cards.expenses, currency)} />
              <SummaryCard label={ar.dashboard.margin} value={formatRatio(data.cards.marginPercent)} />
              <SummaryCard label={ar.dashboard.inventoryValue} value={formatMoney(data.cards.inventoryValue, currency)} />
              <SummaryCard label={ar.dashboard.invoicesCount} value={formatNumber(data.cards.invoicesCount)} />
              <SummaryCard
                label={ar.dashboard.problemInvoices}
                value={formatNumber(data.cards.problemInvoices)}
                tone={data.cards.problemInvoices > 0 ? "warn" : "ok"}
              />
            </div>
          </div>

          <div className="chart-grid">
            <ChartCard title={ar.dashboard.salesVsExpenses}>
              <ResponsiveContainer>
                <BarChart data={data.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6dfd4" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sales" name={ar.dashboard.sales} fill={chartColors.sales} radius={6} />
                  <Bar dataKey="expenses" name={ar.dashboard.expenses} fill={chartColors.expenses} radius={6} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={ar.dashboard.monthlyProfit}>
              <ResponsiveContainer>
                <BarChart data={data.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6dfd4" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="profit" name={ar.dashboard.netProfit} fill={chartColors.profit} radius={6} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={ar.dashboard.cashFlow}>
              <ResponsiveContainer>
                <BarChart data={data.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6dfd4" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="receipts" name={ar.cash.receipts} fill={chartColors.receipts} radius={6} />
                  <Bar dataKey="payments" name={ar.cash.payments} fill={chartColors.payments} radius={6} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={ar.dashboard.topProducts}>
              <ResponsiveContainer>
                <BarChart data={data.topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6dfd4" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={140} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="quantity" name={ar.dashboard.quantity} fill={chartColors.products} radius={6} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="chart-grid">
            <Card title={ar.dashboard.lowStock}>
              {data.lowStock.length === 0 ? <p className="muted">{ar.common.empty}</p> : null}
              <div className="list-stack">
                {data.lowStock.map((product) => (
                  <Link key={product.id} to="/products" className="list-row is-warn">
                    <p className="card-title">{product.name}</p>
                    <p className="muted">
                      {formatNumber(product.stockQuantity)} / {formatNumber(product.minStockLevel)}
                    </p>
                  </Link>
                ))}
              </div>
            </Card>

            <Card title={ar.dashboard.recentInvoices}>
              {invoices.length === 0 ? <p className="muted">{ar.lists.empty}</p> : null}
              <div className="list-stack">
                {invoices.map((invoice) => (
                  <Link key={invoice.id} to={`/invoices/${invoice.id}`} className="list-row">
                    <div className="list-copy">
                      <p className="card-title">{invoice.invoiceNumber}</p>
                      <p className="muted">
                        {invoice.type === "SALE" ? ar.lists.sale : ar.lists.purchase} · {invoice.partyName}
                      </p>
                    </div>
                    <InvoiceStatusBadge status={invoice.status} />
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </Page>
  );
}
