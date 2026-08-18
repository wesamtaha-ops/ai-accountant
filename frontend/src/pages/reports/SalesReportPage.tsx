import { useEffect, useState, type ReactNode } from "react";
import { api, type Party, type Product, type SalesReportRow } from "../../api/client";
import { PeriodFilter, defaultPeriod, type PeriodValue } from "../../components/reports/PeriodFilter";
import { Alert } from "../../components/ui/Alert";
import { Field, inputClassName } from "../../components/ui/Field";
import { Page } from "../../components/ui/Page";
import { PageHeader } from "../../components/ui/PageHeader";
import { formatMoney, formatNumber } from "../../lib/format";
import { ar } from "../../locales/ar";

export function SalesReportPage() {
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod);
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [rows, setRows] = useState<SalesReportRow[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [currency, setCurrency] = useState("EUR");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.salesReport({ ...period, customerId: customerId || undefined, productId: productId || undefined }),
      api.customers(),
      api.products(),
      api.settings(),
    ])
      .then(([nextRows, nextCustomers, nextProducts, settings]) => {
        setRows(nextRows);
        setCustomers(nextCustomers);
        setProducts(nextProducts);
        setCurrency(settings.currency);
        setError("");
      })
      .catch(() => setError(ar.dashboard.disconnected));
  }, [period, customerId, productId]);

  const totals = rows.reduce(
    (sum, row) => ({
      quantity: sum.quantity + row.quantity,
      sales: sum.sales + row.sales,
      profit: sum.profit + row.profit,
    }),
    { quantity: 0, sales: 0, profit: 0 },
  );

  return (
    <Page>
      <PageHeader title={ar.reports.sales} subtitle={ar.reports.salesSubtitle} />
      <div className="toolbar">
        <PeriodFilter value={period} onChange={setPeriod} />
        <Field label={ar.reports.customer}>
          <select className={inputClassName} value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">{ar.reports.allCustomers}</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={ar.reports.product}>
          <select className={inputClassName} value={productId} onChange={(event) => setProductId(event.target.value)}>
            <option value="">{ar.reports.allProducts}</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <ReportTable
        headers={[ar.reports.product, ar.reports.quantity, ar.reports.salesAmount, ar.reports.profitAmount]}
        empty={rows.length === 0}
      >
        {rows.map((row) => (
          <tr key={`${row.productId}-${row.productName}`}>
            <td>{row.productName}</td>
            <td>{formatNumber(row.quantity)}</td>
            <td>{formatMoney(row.sales, currency)}</td>
            <td>{formatMoney(row.profit, currency)}</td>
          </tr>
        ))}
        {rows.length ? (
          <tr className="table-total">
            <td>{ar.common.all}</td>
            <td>{formatNumber(totals.quantity)}</td>
            <td>{formatMoney(totals.sales, currency)}</td>
            <td>{formatMoney(totals.profit, currency)}</td>
          </tr>
        ) : null}
      </ReportTable>
    </Page>
  );
}

function ReportTable({
  headers,
  empty,
  children,
}: {
  headers: string[];
  empty: boolean;
  children: ReactNode;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td className="empty-cell" colSpan={headers.length}>
                {ar.common.empty}
              </td>
            </tr>
          ) : null}
          {children}
        </tbody>
      </table>
    </div>
  );
}
