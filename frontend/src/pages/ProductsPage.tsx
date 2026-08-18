import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Product, type Settings } from "../api/client";
import { SummaryCard } from "../components/reports/ChartCard";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { inputClassName } from "../components/ui/Field";
import { Page } from "../components/ui/Page";
import { PageHeader } from "../components/ui/PageHeader";
import { formatMoney, formatNumber, formatPercent } from "../lib/format";
import { ar } from "../locales/ar";
import { ProductFormModal } from "./products/ProductFormModal";

export function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const [nextProducts, nextSettings] = await Promise.all([api.products(), api.settings()]);
    setProducts(nextProducts);
    setSettings(nextSettings);
  }

  useEffect(() => {
    load().catch(() => setError(ar.dashboard.disconnected));
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category))),
    [products],
  );

  const filtered = products.filter((product) => {
    const haystack = `${product.name} ${product.sku}`.includes(query.trim());
    const matchesCategory = category === "all" || product.category === category;
    return haystack && matchesCategory;
  });

  const lowStockCount = products.filter((product) => product.isLowStock).length;
  const currency = settings?.currency ?? "EUR";

  async function handleDelete(product: Product) {
    if (!window.confirm(ar.common.confirmDelete)) {
      return;
    }

    try {
      await api.deleteProduct(product.id);
      setNotice(ar.products.deleted);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : ar.dashboard.disconnected);
    }
  }

  return (
    <Page>
      <PageHeader
        title={ar.products.title}
        subtitle={ar.products.subtitle}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate("/stock")}>
              {ar.stock.title}
            </Button>
            <Button onClick={() => setCreating(true)}>{ar.products.addProduct}</Button>
          </>
        }
      />

      <div className="kpi-grid">
        <SummaryCard label={ar.stats.products} value={String(products.length)} />
        <SummaryCard
          label={ar.products.lowStockCount}
          value={String(lowStockCount)}
          tone={lowStockCount > 0 ? "warn" : "ok"}
        />
        <SummaryCard label={ar.products.toleranceHint} value={`${settings?.priceTolerancePercent ?? 0}%`} />
      </div>

      <div className="toolbar">
        <input
          className={inputClassName}
          placeholder={ar.products.searchPlaceholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className={inputClassName}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="all">{ar.common.all}</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {notice ? <Alert tone="ok">{notice}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{ar.products.sku}</th>
              <th>{ar.products.name}</th>
              <th>{ar.products.category}</th>
              <th>{ar.products.purchasePrice}</th>
              <th>{ar.products.salePrice}</th>
              <th>{ar.products.margin}</th>
              <th>{ar.products.stock}</th>
              <th>{ar.products.status}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="empty-cell" colSpan={9}>
                  {ar.common.empty}
                </td>
              </tr>
            ) : null}
            {filtered.map((product) => (
              <tr key={product.id}>
                <td className="muted">{product.sku}</td>
                <td>{product.name}</td>
                <td>{product.category}</td>
                <td>{formatMoney(product.expectedPurchasePrice, currency)}</td>
                <td>{formatMoney(product.expectedSalePrice, currency)}</td>
                <td>{formatPercent(product.expectedMarginPercent)}</td>
                <td>
                  {formatNumber(product.stockQuantity)} / {formatNumber(product.minStockLevel)}
                </td>
                <td>
                  <Badge tone={product.isLowStock ? "warn" : "ok"}>
                    {product.isLowStock ? ar.products.lowStock : ar.products.inStock}
                  </Badge>
                </td>
                <td>
                  <div className="page-actions">
                    <Button variant="secondary" onClick={() => setEditing(product)}>
                      {ar.common.edit}
                    </Button>
                    <Button variant="ghost" onClick={() => handleDelete(product)}>
                      {ar.common.delete}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating || editing ? (
        <ProductFormModal
          product={editing}
          categories={categories}
          currency={currency}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setCreating(false);
            setEditing(null);
            setNotice(ar.products.saved);
            await load();
          }}
        />
      ) : null}
    </Page>
  );
}
