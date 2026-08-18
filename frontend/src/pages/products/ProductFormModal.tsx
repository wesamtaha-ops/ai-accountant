import { useMemo, useState, type FormEvent } from "react";
import { api, type PriceCheckResult, type Product, type ProductInput } from "../../api/client";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Field, inputClassName } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { formatMoney, formatPercent } from "../../lib/format";
import { ar } from "../../locales/ar";

type ProductFormModalProps = {
  product?: Product | null;
  categories: string[];
  currency: string;
  onClose: () => void;
  onSaved: () => void;
};

const emptyForm: ProductInput = {
  sku: "",
  name: "",
  category: "",
  unit: ar.products.units[0],
  expectedPurchasePrice: 0,
  expectedSalePrice: 0,
  stockQuantity: 0,
  minStockLevel: 0,
};

export function ProductFormModal({
  product,
  categories,
  currency,
  onClose,
  onSaved,
}: ProductFormModalProps) {
  const [form, setForm] = useState<ProductInput>(
    product
      ? {
          sku: product.sku,
          name: product.name,
          category: product.category,
          unit: product.unit,
          expectedPurchasePrice: product.expectedPurchasePrice,
          expectedSalePrice: product.expectedSalePrice,
          stockQuantity: product.stockQuantity,
          minStockLevel: product.minStockLevel,
        }
      : emptyForm,
  );
  const [invoicePrice, setInvoicePrice] = useState(
    product ? String(product.expectedPurchasePrice) : "",
  );
  const [checkResult, setCheckResult] = useState<PriceCheckResult | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const unitProfit = form.expectedSalePrice - form.expectedPurchasePrice;
  const margin =
    form.expectedPurchasePrice > 0 ? (unitProfit / form.expectedPurchasePrice) * 100 : 0;

  const categoryOptions = useMemo(() => {
    const values = new Set(categories);
    if (form.category) {
      values.add(form.category);
    }
    return Array.from(values);
  }, [categories, form.category]);

  function update<K extends keyof ProductInput>(key: K, value: ProductInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (product) {
        await api.updateProduct(product.id, form);
      } else {
        await api.createProduct(form);
      }
      onSaved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : ar.common.required);
    } finally {
      setSaving(false);
    }
  }

  async function handlePriceCheck() {
    if (!product) {
      return;
    }

    try {
      const result = await api.checkProductPrice(product.id, Number(invoicePrice));
      setCheckResult(result);
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : ar.common.required);
    }
  }

  return (
    <Modal title={product ? ar.products.editProduct : ar.products.addProduct} onClose={onClose}>
      <form className="list-stack" onSubmit={handleSubmit}>
        <div className="form-grid">
          <Field label={ar.products.sku}>
            <input
              className={inputClassName}
              value={form.sku}
              onChange={(event) => update("sku", event.target.value)}
              required
            />
          </Field>
          <Field label={ar.products.name}>
            <input
              className={inputClassName}
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              required
            />
          </Field>
          <Field label={ar.products.category}>
            <input
              className={inputClassName}
              list="product-categories"
              value={form.category}
              onChange={(event) => update("category", event.target.value)}
              required
            />
            <datalist id="product-categories">
              {categoryOptions.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </Field>
          <Field label={ar.products.unit}>
            <select
              className={inputClassName}
              value={form.unit}
              onChange={(event) => update("unit", event.target.value)}
            >
              {ar.products.units.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </Field>
          <Field label={ar.products.purchasePrice}>
            <input
              className={inputClassName}
              type="number"
              min="0"
              step="0.01"
              value={form.expectedPurchasePrice}
              onChange={(event) => update("expectedPurchasePrice", Number(event.target.value))}
              required
            />
          </Field>
          <Field label={ar.products.salePrice}>
            <input
              className={inputClassName}
              type="number"
              min="0"
              step="0.01"
              value={form.expectedSalePrice}
              onChange={(event) => update("expectedSalePrice", Number(event.target.value))}
              required
            />
          </Field>
          <Field label={ar.products.stock}>
            <input
              className={inputClassName}
              type="number"
              min="0"
              step="0.001"
              value={form.stockQuantity}
              onChange={(event) => update("stockQuantity", Number(event.target.value))}
              required
            />
          </Field>
          <Field label={ar.products.minStock}>
            <input
              className={inputClassName}
              type="number"
              min="0"
              step="0.001"
              value={form.minStockLevel}
              onChange={(event) => update("minStockLevel", Number(event.target.value))}
              required
            />
          </Field>
        </div>

        <div className="kpi-grid">
          <InfoChip label={ar.products.unitProfit} value={formatMoney(unitProfit, currency)} />
          <InfoChip label={ar.products.margin} value={formatPercent(margin)} />
        </div>

        {product ? (
          <div className="alert alert-warn">
            <p className="card-title">{ar.products.priceCheckTitle}</p>
            <p>{ar.products.priceCheckHint}</p>
            <div className="toolbar">
              <Field label={ar.products.invoicePrice}>
                <input
                  className={inputClassName}
                  type="number"
                  min="0"
                  step="0.01"
                  value={invoicePrice}
                  onChange={(event) => setInvoicePrice(event.target.value)}
                />
              </Field>
              <Button variant="secondary" onClick={handlePriceCheck}>
                {ar.products.checkPrice}
              </Button>
            </div>
            {checkResult ? <PriceCheckCard result={checkResult} currency={currency} /> : null}
          </div>
        ) : null}

        {error ? <Alert tone="error">{error}</Alert> : null}

        <div className="page-actions">
          <Button variant="ghost" onClick={onClose}>
            {ar.common.cancel}
          </Button>
          <Button type="submit" disabled={saving}>
            {ar.common.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
    </div>
  );
}

function PriceCheckCard({ result, currency }: { result: PriceCheckResult; currency: string }) {
  const tone = result.exceedsTolerance
    ? "alert alert-error"
    : result.direction === "equal"
      ? "alert alert-ok"
      : "alert alert-warn";

  const title = result.exceedsTolerance
    ? ar.products.warning
    : result.direction === "equal"
      ? ar.products.match
      : ar.products.withinTolerance;

  return (
    <div className={tone}>
      <p className="card-title">{title}</p>
      <p>{result.message}</p>
      <p>
        {ar.products.expectedPrice}: {formatMoney(result.expectedPrice, currency)} ·{" "}
        {ar.products.invoicePrice}: {formatMoney(result.invoicePrice, currency)} ·{" "}
        {ar.products.difference}: {formatPercent(result.percentChange)}
      </p>
    </div>
  );
}
