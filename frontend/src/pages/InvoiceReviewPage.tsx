import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  api,
  type FieldTone,
  type InvoiceReadResult,
  type InvoiceType,
  type Party,
  type PaymentMethod,
  type PaymentStatus,
  type Product,
} from "../api/client";
import { AuditPanel } from "../components/invoice/AuditPanel";
import { SafetyScore } from "../components/invoice/SafetyScore";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Field, inputClassName } from "../components/ui/Field";
import { Page } from "../components/ui/Page";
import { PageHeader } from "../components/ui/PageHeader";
import { formatMoney } from "../lib/format";
import { computeInvoiceTotals, computeLineTotal } from "../lib/invoiceMath";
import { loadReadResult, storeReadResult } from "../lib/invoiceReadStore";
import { ar } from "../locales/ar";

type DraftLine = {
  key: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  statedTotal: number;
};

const toneClass: Record<FieldTone, string> = {
  ok: "tone-ok",
  warn: "tone-warn",
  error: "tone-error",
};

export function InvoiceReviewPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<InvoiceReadResult | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<InvoiceType>("PURCHASE");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [date, setDate] = useState("");
  const [partyId, setPartyId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("UNPAID");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [statedTotal, setStatedTotal] = useState(0);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    const stored = loadReadResult();
    if (!stored) {
      navigate("/invoices/upload", { replace: true });
      return;
    }

    applyResult(stored);
    Promise.all([api.products(), api.customers(), api.suppliers()]).then(
      ([nextProducts, nextCustomers, nextSuppliers]) => {
        setProducts(nextProducts);
        setCustomers(nextCustomers);
        setSuppliers(nextSuppliers);
      },
    );
  }, [navigate]);

  function applyResult(next: InvoiceReadResult) {
    setResult(next);
    storeReadResult(next);
    setType(next.draft.type);
    setInvoiceNumber(next.draft.invoiceNumber);
    setDate(next.draft.date.slice(0, 10));
    setPartyId((next.draft.type === "SALE" ? next.draft.customerId : next.draft.supplierId) ?? "");
    setPaymentStatus(next.draft.paymentStatus);
    setPaymentMethod(next.draft.paymentMethod ?? "");
    setNotes(next.draft.notes ?? "");
    setDiscount(next.draft.discount);
    setTax(next.draft.tax);
    setStatedTotal(next.draft.statedTotal ?? next.computed.total);
    setPreviewUrl(next.previewUrl);
    setLines(
      next.draft.lines.map((line, index) => ({
        key: `line-${index}`,
        productId: line.productId ?? "",
        productName: line.productName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        statedTotal: line.lineTotalStated ?? computeLineTotal(line.quantity, line.unitPrice, line.discount),
      })),
    );
  }

  const totals = useMemo(() => computeInvoiceTotals(lines, discount, tax), [lines, discount, tax]);
  const parties = type === "SALE" ? customers : suppliers;
  const currency = result?.currency ?? "EUR";
  const isPdf = previewUrl.toLowerCase().endsWith(".pdf");

  function toDraft() {
    return {
      invoiceNumber,
      type,
      date,
      customerId: type === "SALE" ? partyId || null : null,
      supplierId: type === "PURCHASE" ? partyId || null : null,
      paymentStatus,
      paymentMethod: paymentMethod || null,
      notes,
      discount,
      tax,
      statedTotal,
      source: "OCR" as const,
      originalFileUrl: previewUrl,
      lines: lines.map((line) => ({
        productId: line.productId || null,
        productName: line.productName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        tax: 0,
        lineTotalStated: line.statedTotal,
      })),
    };
  }

  async function recheck() {
    try {
      applyResult(await api.previewInvoice(toDraft()));
      setNotice(ar.invoices.audited);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : ar.dashboard.disconnected);
    }
  }

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line) => {
        if (line.key !== key) {
          return line;
        }
        const next = { ...line, ...patch };
        if (patch.statedTotal == null) {
          next.statedTotal = computeLineTotal(next.quantity, next.unitPrice, next.discount);
        }
        return next;
      }),
    );
  }

  function handleProductChange(key: string, productId: string) {
    const product = products.find((item) => item.id === productId);
    updateLine(key, {
      productId,
      productName: product?.name ?? "",
      unitPrice: product ? (type === "SALE" ? product.expectedSalePrice : product.expectedPurchasePrice) : 0,
    });
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const saved = await api.createInvoice(toDraft());
      setNotice(ar.invoices.saved);
      navigate(`/invoices/${saved.id}`, { replace: true });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : ar.dashboard.disconnected);
    } finally {
      setSaving(false);
    }
  }

  if (!result) {
    return null;
  }

  return (
    <Page>
      <PageHeader
        title={ar.invoices.reviewTitle}
        subtitle={ar.invoices.reviewSubtitle}
        actions={
          <Button variant="ghost" onClick={() => navigate("/invoices/upload")}>
            {ar.common.back}
          </Button>
        }
      />

      <SafetyScore score={result.safetyScore} issuesCount={result.auditResults.length} />
      <div className="toolbar">
        <Legend tone="ok" label={ar.invoices.legendOk} />
        <Legend tone="warn" label={ar.invoices.legendWarn} />
        <Legend tone="error" label={ar.invoices.legendError} />
        <p className="muted">
          {result.provider === "gemini" ? ar.invoices.providerGemini : ar.invoices.providerMock}
        </p>
      </div>

      {notice ? <Alert tone="ok">{notice}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Alert tone="info">{ar.invoices.saveThenReview}</Alert>

      <div className="split split-wide">
        <Card title={ar.invoices.originalImage}>
          {isPdf ? (
            <div className="list-stack">
              <p className="muted">{ar.invoices.pdfFile}</p>
              <a className="link-quiet" href={previewUrl} target="_blank" rel="noreferrer">
                {ar.invoices.openFile}
              </a>
            </div>
          ) : (
            <img src={previewUrl} alt={ar.invoices.originalImage} className="preview-image" />
          )}
        </Card>

        <div className="list-stack">
          <article className="card">
            <h3 className="card-title">{ar.invoices.extractedData}</h3>
            <div className="form-grid">
              <ToneField tone={result.fieldTones.invoiceNumber} label={ar.invoices.number}>
                <input className={inputClassName} value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />
              </ToneField>
              <ToneField tone={result.fieldTones.date} label={ar.invoices.date}>
                <input className={inputClassName} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </ToneField>
              <ToneField tone={result.fieldTones.party} label={type === "SALE" ? ar.invoices.customer : ar.invoices.supplier}>
                <select className={inputClassName} value={partyId} onChange={(event) => setPartyId(event.target.value)}>
                  <option value="">{type === "SALE" ? ar.invoices.chooseCustomer : ar.invoices.chooseSupplier}</option>
                  {parties.map((party) => (
                    <option key={party.id} value={party.id}>
                      {party.name}
                    </option>
                  ))}
                </select>
              </ToneField>
              <Field label={ar.invoices.paymentStatus}>
                <select
                  className={inputClassName}
                  value={paymentStatus}
                  onChange={(event) => setPaymentStatus(event.target.value as PaymentStatus)}
                >
                  <option value="UNPAID">{ar.invoices.unpaid}</option>
                  <option value="PAID">{ar.invoices.paid}</option>
                  <option value="PARTIAL">{ar.invoices.partial}</option>
                </select>
              </Field>
              <Field label={ar.invoices.paymentMethod}>
                <select
                  className={inputClassName}
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod | "")}
                >
                  <option value="">{ar.common.all}</option>
                  <option value="CASH">{ar.invoices.cash}</option>
                  <option value="CARD">{ar.invoices.card}</option>
                  <option value="TRANSFER">{ar.invoices.transfer}</option>
                  <option value="OTHER">{ar.invoices.other}</option>
                </select>
              </Field>
              <Field label={ar.invoices.notes}>
                <input className={inputClassName} value={notes} onChange={(event) => setNotes(event.target.value)} />
              </Field>
            </div>
          </article>

          <article className="card">
            <div className="page-header">
              <h3 className="card-title">{ar.invoices.lines}</h3>
              <Button variant="secondary" onClick={() => setLines((current) => [...current, emptyLine()])}>
                {ar.invoices.addLine}
              </Button>
            </div>
            <div className="list-stack">
              {lines.map((line, index) => {
                const tones = result.fieldTones.lines[index];
                return (
                  <div key={line.key} className="card">
                    <ToneField tone={tones?.product ?? "ok"} label={ar.invoices.product}>
                      <select
                        className={inputClassName}
                        value={line.productId}
                        onChange={(event) => handleProductChange(line.key, event.target.value)}
                      >
                        <option value="">{line.productName || ar.invoices.chooseProduct}</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </ToneField>
                    {!line.productId ? <Alert tone="warn">{ar.invoices.unmatchedProduct}</Alert> : null}
                    <div className="form-grid">
                      <Field label={ar.invoices.quantity}>
                        <input
                          className={inputClassName}
                          type="number"
                          value={line.quantity}
                          onChange={(event) => updateLine(line.key, { quantity: Number(event.target.value) })}
                        />
                      </Field>
                      <ToneField tone={tones?.unitPrice ?? "ok"} label={ar.invoices.unitPrice}>
                        <input
                          className={inputClassName}
                          type="number"
                          value={line.unitPrice}
                          onChange={(event) => updateLine(line.key, { unitPrice: Number(event.target.value) })}
                        />
                      </ToneField>
                      <Field label={ar.invoices.lineTotal}>
                        <p className="card-title">
                          {formatMoney(computeLineTotal(line.quantity, line.unitPrice, line.discount), currency)}
                        </p>
                      </Field>
                      <ToneField tone={tones?.lineTotal ?? "ok"} label={ar.invoices.statedLineTotal}>
                        <input
                          className={inputClassName}
                          type="number"
                          value={line.statedTotal}
                          onChange={(event) => updateLine(line.key, { statedTotal: Number(event.target.value) })}
                        />
                      </ToneField>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="card">
            <div className="list-row">
              <span className="muted">{ar.invoices.computedTotal}</span>
              <span className="kpi-value">{formatMoney(totals.total, currency)}</span>
            </div>
            <ToneField tone={result.fieldTones.total} label={ar.invoices.statedTotal}>
              <input
                className={inputClassName}
                type="number"
                value={statedTotal}
                onChange={(event) => setStatedTotal(Number(event.target.value))}
              />
            </ToneField>
          </article>

          <AuditPanel results={result.auditResults} review={result.aiReview} currency={currency} />

          <div className="page-actions">
            <Button variant="secondary" onClick={recheck}>
              {ar.invoices.recheck}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {ar.invoices.saveDraft}
            </Button>
          </div>
        </div>
      </div>
    </Page>
  );
}

function ToneField({
  tone,
  label,
  children,
}: {
  tone: FieldTone;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={`tone-box ${toneClass[tone]}`}>
      <Field label={label}>{children}</Field>
    </div>
  );
}

function Legend({ tone, label }: { tone: FieldTone; label: string }) {
  return (
    <span className={`badge ${toneClass[tone]}`}>{label}</span>
  );
}

function emptyLine(): DraftLine {
  return {
    key: `${Date.now()}-${Math.random()}`,
    productId: "",
    productName: "",
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    statedTotal: 0,
  };
}
