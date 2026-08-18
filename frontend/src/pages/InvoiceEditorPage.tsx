import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  api,
  type AiReview,
  type AuditResult,
  type InvoiceDetail,
  type InvoiceInput,
  type InvoiceType,
  type Party,
  type PaymentMethod,
  type PaymentStatus,
  type Product,
  type Settings,
} from "../api/client";
import { AuditPanel } from "../components/invoice/AuditPanel";
import { InvoiceStatusBadge } from "../components/invoice/InvoiceStatusBadge";
import { SafetyScore } from "../components/invoice/SafetyScore";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Field, inputClassName } from "../components/ui/Field";
import { Page } from "../components/ui/Page";
import { PageHeader } from "../components/ui/PageHeader";
import { formatMoney } from "../lib/format";
import { computeInvoiceTotals, computeLineTotal } from "../lib/invoiceMath";
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

function newLine(): DraftLine {
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

export function InvoiceEditorPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";
  const initialType = searchParams.get("type") === "PURCHASE" ? "PURCHASE" : "SALE";

  const [type, setType] = useState<InvoiceType>(initialType);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [partyId, setPartyId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("UNPAID");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [statedTotal, setStatedTotal] = useState<number | "">("");
  const [lines, setLines] = useState<DraftLine[]>([newLine()]);
  const [editable, setEditable] = useState(true);
  const [statusLabel, setStatusLabel] = useState<"DRAFT" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED">("DRAFT");
  const [safetyScore, setSafetyScore] = useState<number | null>(null);
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);
  const [aiReview, setAiReview] = useState<AiReview | null>(null);
  const [source, setSource] = useState<"MANUAL" | "OCR">("MANUAL");
  const [originalFileUrl, setOriginalFileUrl] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [auditing, setAuditing] = useState(false);

  const parties = type === "SALE" ? customers : suppliers;
  const totals = useMemo(() => computeInvoiceTotals(lines, discount, tax), [lines, discount, tax]);
  const currency = settings?.currency ?? "EUR";

  useEffect(() => {
    async function load() {
      const [nextProducts, nextCustomers, nextSuppliers, nextSettings] = await Promise.all([
        api.products(),
        api.customers(),
        api.suppliers(),
        api.settings(),
      ]);
      setProducts(nextProducts);
      setCustomers(nextCustomers);
      setSuppliers(nextSuppliers);
      setSettings(nextSettings);

      if (isNew) {
        const next = await api.nextInvoiceNumber(initialType);
        setInvoiceNumber(next.invoiceNumber);
        return;
      }

      if (!id) {
        return;
      }

      applyInvoice(await api.invoice(id));
    }

    load().catch(() => setError(ar.dashboard.disconnected));
  }, [id, isNew, initialType]);

  function applyInvoice(invoice: InvoiceDetail) {
    setType(invoice.type);
    setInvoiceNumber(invoice.invoiceNumber);
    setDate(invoice.date.slice(0, 10));
    setPartyId(invoice.type === "SALE" ? invoice.customerId ?? "" : invoice.supplierId ?? "");
    setPaymentStatus(invoice.paymentStatus);
    setPaymentMethod(invoice.paymentMethod ?? "");
    setNotes(invoice.notes ?? "");
    setDiscount(invoice.discountComputed);
    setTax(invoice.taxComputed);
    setStatedTotal(invoice.totalStated);
    setEditable(invoice.editable);
    setStatusLabel(invoice.status);
    setSafetyScore(invoice.safetyScore);
    setAuditResults(invoice.auditResults);
    setAiReview(invoice.aiReview);
    setSource(invoice.source);
    setOriginalFileUrl(invoice.originalFileUrl);
    setLines(
      invoice.lines.map((line) => ({
        key: line.id ?? newLine().key,
        productId: line.productId ?? "",
        productName: line.productName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        statedTotal: line.lineTotalStated,
      })),
    );
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

  function applyDefaultTax() {
    if (!settings) {
      return;
    }
    const subtotal = computeInvoiceTotals(lines, discount, 0).subtotal;
    setTax(Math.round(((subtotal * settings.defaultTaxPercent) / 100) * 100) / 100);
  }

  function toPayload(): InvoiceInput {
    return {
      invoiceNumber,
      type,
      date,
      customerId: type === "SALE" ? partyId : null,
      supplierId: type === "PURCHASE" ? partyId : null,
      paymentStatus,
      paymentMethod: paymentMethod || null,
      notes,
      discount,
      tax,
      statedTotal: statedTotal === "" ? totals.total : Number(statedTotal),
      source,
      originalFileUrl,
      lines: lines
        .filter((line) => line.productName.trim().length > 0)
        .map((line) => ({
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

  async function handleAudit() {
    if (!id || isNew) {
      return;
    }

    setAuditing(true);
    setError("");
    try {
      applyInvoice(await api.auditInvoice(id));
      setNotice(ar.invoices.audited);
    } catch (auditError) {
      setError(auditError instanceof Error ? auditError.message : ar.dashboard.disconnected);
    } finally {
      setAuditing(false);
    }
  }

  async function handleSubmit() {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = toPayload();
      const saved = isNew ? await api.createInvoice(payload) : await api.updateInvoice(id as string, payload);
      setNotice(ar.invoices.saved);
      navigate(`/invoices/${saved.id}`, { replace: true });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : ar.dashboard.disconnected);
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    if (!id || isNew || !window.confirm(ar.invoices.confirmApprove)) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      applyInvoice(await api.approveInvoice(id));
      setNotice(ar.invoices.approved);
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : ar.dashboard.disconnected);
    } finally {
      setSaving(false);
    }
  }

  async function handleReject() {
    if (!id || isNew || !window.confirm(ar.invoices.confirmReject)) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      applyInvoice(await api.rejectInvoice(id));
      setNotice(ar.invoices.rejected);
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : ar.dashboard.disconnected);
    } finally {
      setSaving(false);
    }
  }

  const title = type === "SALE" ? ar.invoices.saleTitle : ar.invoices.purchaseTitle;
  const canDecide = !isNew && statusLabel !== "APPROVED" && statusLabel !== "REJECTED";

  return (
    <Page>
      <PageHeader
        title={title}
        subtitle={ar.invoices.draftHint}
        actions={
          <>
            {!isNew ? <InvoiceStatusBadge status={statusLabel} /> : null}
            <Button variant="ghost" onClick={() => navigate("/invoices")}>
              {ar.common.back}
            </Button>
          </>
        }
      />

      {!isNew ? <SafetyScore score={safetyScore} issuesCount={auditResults.length} /> : null}
      <AuditPanel results={auditResults} review={aiReview} currency={currency} />
      {originalFileUrl ? (
        <Card title={ar.invoices.originalImage}>
          {originalFileUrl.toLowerCase().endsWith(".pdf") ? (
            <a className="link-quiet" href={originalFileUrl} target="_blank" rel="noreferrer">
              {ar.invoices.openFile}
            </a>
          ) : (
            <img src={originalFileUrl} alt={ar.invoices.originalImage} className="preview-image" />
          )}
        </Card>
      ) : null}

      {!editable ? <Alert tone="info">{ar.invoices.locked}</Alert> : null}
      {notice ? <Alert tone="ok">{notice}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <article className="card form-grid">
        <Field label={ar.invoices.number}>
          <input className={inputClassName} value={invoiceNumber} disabled={!editable} onChange={(event) => setInvoiceNumber(event.target.value)} />
        </Field>
        <Field label={ar.invoices.date}>
          <input className={inputClassName} type="date" value={date} disabled={!editable} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label={type === "SALE" ? ar.invoices.customer : ar.invoices.supplier}>
          <select className={inputClassName} value={partyId} disabled={!editable} onChange={(event) => setPartyId(event.target.value)}>
            <option value="">{type === "SALE" ? ar.invoices.chooseCustomer : ar.invoices.chooseSupplier}</option>
            {parties.map((party) => (
              <option key={party.id} value={party.id}>
                {party.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={ar.invoices.paymentStatus}>
          <select
            className={inputClassName}
            value={paymentStatus}
            disabled={!editable}
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
            disabled={!editable}
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
          <input className={inputClassName} value={notes} disabled={!editable} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </article>

      <article className="card">
        <div className="page-header">
          <h3 className="card-title">{ar.invoices.lines}</h3>
          {editable ? (
            <Button variant="secondary" onClick={() => setLines((current) => [...current, newLine()])}>
              {ar.invoices.addLine}
            </Button>
          ) : null}
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{ar.invoices.product}</th>
                <th>{ar.invoices.quantity}</th>
                <th>{ar.invoices.unitPrice}</th>
                <th>{ar.invoices.lineDiscount}</th>
                <th>{ar.invoices.lineTotal}</th>
                <th>{ar.invoices.statedLineTotal}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr
                  key={line.key}
                  className={
                    line.statedTotal !== computeLineTotal(line.quantity, line.unitPrice, line.discount)
                      ? "tone-error"
                      : undefined
                  }
                >
                  <td>
                    <select
                      className={inputClassName}
                      value={line.productId}
                      disabled={!editable}
                      onChange={(event) => handleProductChange(line.key, event.target.value)}
                    >
                      <option value="">{ar.invoices.chooseProduct}</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className={inputClassName}
                      type="number"
                      min="0"
                      step="0.001"
                      value={line.quantity}
                      disabled={!editable}
                      onChange={(event) => updateLine(line.key, { quantity: Number(event.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      className={inputClassName}
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      disabled={!editable}
                      onChange={(event) => updateLine(line.key, { unitPrice: Number(event.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      className={inputClassName}
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.discount}
                      disabled={!editable}
                      onChange={(event) => updateLine(line.key, { discount: Number(event.target.value) })}
                    />
                  </td>
                  <td>
                    {formatMoney(computeLineTotal(line.quantity, line.unitPrice, line.discount), currency)}
                  </td>
                  <td>
                    <input
                      className={inputClassName}
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.statedTotal}
                      disabled={!editable}
                      onChange={(event) => updateLine(line.key, { statedTotal: Number(event.target.value) })}
                    />
                  </td>
                  <td>
                    {editable && lines.length > 1 ? (
                      <Button variant="ghost" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>
                        {ar.common.delete}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <TotalRow label={ar.invoices.subtotal} value={formatMoney(totals.subtotal, currency)} />
        <Field label={ar.invoices.discount}>
          <input
            className={inputClassName}
            type="number"
            min="0"
            step="0.01"
            value={discount}
            disabled={!editable}
            onChange={(event) => setDiscount(Number(event.target.value))}
          />
        </Field>
        <div className="toolbar">
          <Field label={ar.invoices.tax}>
            <input
              className={inputClassName}
              type="number"
              min="0"
              step="0.01"
              value={tax}
              disabled={!editable}
              onChange={(event) => setTax(Number(event.target.value))}
            />
          </Field>
          {editable ? (
            <Button variant="secondary" onClick={applyDefaultTax}>
              {ar.invoices.applyTax}
            </Button>
          ) : null}
        </div>
        <TotalRow label={ar.invoices.computedTotal} value={formatMoney(totals.total, currency)} strong />
        <Field label={ar.invoices.statedTotal}>
          <input
            className={inputClassName}
            type="number"
            min="0"
            step="0.01"
            value={statedTotal === "" ? totals.total : statedTotal}
            disabled={!editable}
            onChange={(event) => setStatedTotal(Number(event.target.value))}
          />
        </Field>
      </article>

      <div className="page-actions">
        {!isNew ? (
          <Button variant="secondary" onClick={handleAudit} disabled={auditing}>
            {ar.invoices.audit}
          </Button>
        ) : null}
        {canDecide ? (
          <Button variant="ghost" onClick={handleReject} disabled={saving}>
            {ar.invoices.reject}
          </Button>
        ) : null}
        {canDecide ? (
          <Button onClick={handleApprove} disabled={saving}>
            {ar.invoices.approve}
          </Button>
        ) : null}
        {editable ? (
          <Button variant="secondary" onClick={handleSubmit} disabled={saving}>
            {ar.invoices.saveDraft}
          </Button>
        ) : null}
      </div>
    </Page>
  );
}

function TotalRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="list-row">
      <span className="muted">{label}</span>
      <span className={strong ? "kpi-value" : "card-title"}>{value}</span>
    </div>
  );
}
