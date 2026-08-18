import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Product, type StockMovement } from "../api/client";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { inputClassName } from "../components/ui/Field";
import { Page } from "../components/ui/Page";
import { PageHeader } from "../components/ui/PageHeader";
import { formatNumber } from "../lib/format";
import { ar } from "../locales/ar";

export function StockMovementsPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("all");
  const [error, setError] = useState("");

  async function load(nextProductId = productId) {
    const [rows, nextProducts] = await Promise.all([
      api.stockMovements(nextProductId === "all" ? undefined : nextProductId),
      api.products(),
    ]);
    setMovements(rows);
    setProducts(nextProducts);
  }

  useEffect(() => {
    load().catch(() => setError(ar.dashboard.disconnected));
  }, []);

  return (
    <Page>
      <PageHeader title={ar.stock.title} subtitle={ar.stock.subtitle} />

      <div className="toolbar">
        <select
          className={inputClassName}
          value={productId}
          onChange={(event) => {
            const value = event.target.value;
            setProductId(value);
            load(value).catch(() => setError(ar.dashboard.disconnected));
          }}
        >
          <option value="all">{ar.common.all}</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{ar.stock.date}</th>
              <th>{ar.stock.product}</th>
              <th>{ar.stock.type}</th>
              <th>{ar.stock.invoice}</th>
              <th>{ar.stock.inbound}</th>
              <th>{ar.stock.outbound}</th>
              <th>{ar.stock.balance}</th>
            </tr>
          </thead>
          <tbody>
            {movements.length === 0 ? (
              <tr>
                <td className="empty-cell" colSpan={7}>
                  {ar.common.empty}
                </td>
              </tr>
            ) : null}
            {movements.map((item) => (
              <tr key={item.id}>
                <td>{item.date.slice(0, 10)}</td>
                <td>{item.productName}</td>
                <td>
                  <Badge tone={item.type === "IN" ? "ok" : "warn"}>{item.type === "IN" ? ar.stock.in : ar.stock.out}</Badge>
                </td>
                <td>
                  {item.invoiceId ? (
                    <Link className="link-quiet" to={`/invoices/${item.invoiceId}`}>
                      {item.invoiceNumber}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{formatNumber(item.quantityIn)}</td>
                <td>{formatNumber(item.quantityOut)}</td>
                <td>{formatNumber(item.balanceAfter)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
