import { useEffect, useState } from "react";
import { api, type Party, type Product, type PurchasesReportRow } from "../../api/client";
import { PeriodFilter, defaultPeriod, type PeriodValue } from "../../components/reports/PeriodFilter";
import { Alert } from "../../components/ui/Alert";
import { Field, inputClassName } from "../../components/ui/Field";
import { Page } from "../../components/ui/Page";
import { PageHeader } from "../../components/ui/PageHeader";
import { formatMoney, formatNumber } from "../../lib/format";
import { ar } from "../../locales/ar";

export function PurchasesReportPage() {
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod);
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [rows, setRows] = useState<PurchasesReportRow[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [currency, setCurrency] = useState("EUR");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.purchasesReport({ ...period, supplierId: supplierId || undefined, productId: productId || undefined }),
      api.suppliers(),
      api.products(),
      api.settings(),
    ])
      .then(([nextRows, nextSuppliers, nextProducts, settings]) => {
        setRows(nextRows);
        setSuppliers(nextSuppliers);
        setProducts(nextProducts);
        setCurrency(settings.currency);
        setError("");
      })
      .catch(() => setError(ar.dashboard.disconnected));
  }, [period, supplierId, productId]);

  const totals = rows.reduce(
    (sum, row) => ({
      quantity: sum.quantity + row.quantity,
      cost: sum.cost + row.cost,
    }),
    { quantity: 0, cost: 0 },
  );

  return (
    <Page>
      <PageHeader title={ar.reports.purchases} subtitle={ar.reports.purchasesSubtitle} />
      <div className="toolbar">
        <PeriodFilter value={period} onChange={setPeriod} />
        <Field label={ar.reports.supplier}>
          <select className={inputClassName} value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="">{ar.reports.allSuppliers}</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
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
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{ar.reports.invoice}</th>
              <th>{ar.reports.date}</th>
              <th>{ar.reports.supplier}</th>
              <th>{ar.reports.product}</th>
              <th>{ar.reports.quantity}</th>
              <th>{ar.reports.cost}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="empty-cell" colSpan={6}>
                  {ar.common.empty}
                </td>
              </tr>
            ) : null}
            {rows.map((row, index) => (
              <tr key={`${row.invoiceNumber}-${row.productName}-${index}`}>
                <td>{row.invoiceNumber}</td>
                <td>{String(row.date).slice(0, 10)}</td>
                <td>{row.supplierName}</td>
                <td>{row.productName}</td>
                <td>{formatNumber(row.quantity)}</td>
                <td>{formatMoney(row.cost, currency)}</td>
              </tr>
            ))}
            {rows.length ? (
              <tr className="table-total">
                <td colSpan={4}>{ar.common.all}</td>
                <td>{formatNumber(totals.quantity)}</td>
                <td>{formatMoney(totals.cost, currency)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
