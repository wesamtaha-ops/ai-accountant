import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type CashLedger, type CashMovementInput, type PaymentMethod } from "../api/client";
import { SummaryCard } from "../components/reports/ChartCard";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Field, inputClassName } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { Page } from "../components/ui/Page";
import { PageHeader } from "../components/ui/PageHeader";
import { formatMoney } from "../lib/format";
import { ar } from "../locales/ar";

export function CashPage() {
  const [ledger, setLedger] = useState<CashLedger | null>(null);
  const [currency, setCurrency] = useState("EUR");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<CashMovementInput>({
    type: "RECEIPT",
    amount: 0,
    description: "",
    date: new Date().toISOString().slice(0, 10),
    paymentMethod: "CASH",
  });

  async function load() {
    const [nextLedger, settings] = await Promise.all([api.cashLedger(), api.settings()]);
    setLedger(nextLedger);
    setCurrency(settings.currency);
  }

  useEffect(() => {
    load().catch(() => setError(ar.dashboard.disconnected));
  }, []);

  async function handleSave() {
    try {
      await api.createCashMovement(form);
      setNotice(ar.cash.saved);
      setOpen(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : ar.dashboard.disconnected);
    }
  }

  return (
    <Page>
      <PageHeader
        title={ar.cash.title}
        subtitle={ar.cash.subtitle}
        actions={<Button onClick={() => setOpen(true)}>{ar.cash.add}</Button>}
      />

      {ledger ? (
        <div className="kpi-grid">
          <SummaryCard label={ar.cash.opening} value={formatMoney(ledger.openingBalance, currency)} />
          <SummaryCard label={ar.cash.receipts} value={formatMoney(ledger.receipts, currency)} tone="ok" />
          <SummaryCard label={ar.cash.payments} value={formatMoney(ledger.payments, currency)} tone="warn" />
          <SummaryCard label={ar.cash.current} value={formatMoney(ledger.currentBalance, currency)} />
        </div>
      ) : null}

      {notice ? <Alert tone="ok">{notice}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{ar.cash.date}</th>
              <th>{ar.stock.type}</th>
              <th>{ar.cash.description}</th>
              <th>{ar.cash.invoice}</th>
              <th>{ar.cash.amount}</th>
            </tr>
          </thead>
          <tbody>
            {ledger?.movements.length ? null : (
              <tr>
                <td className="empty-cell" colSpan={5}>
                  {ar.common.empty}
                </td>
              </tr>
            )}
            {ledger?.movements.map((item) => (
              <tr key={item.id}>
                <td>{item.date.slice(0, 10)}</td>
                <td>
                  <Badge tone={item.type === "RECEIPT" ? "ok" : "warn"}>
                    {item.type === "RECEIPT" ? ar.cash.receipt : ar.cash.payment}
                  </Badge>
                </td>
                <td>{item.description}</td>
                <td>
                  {item.invoiceId ? (
                    <Link className="link-quiet" to={`/invoices/${item.invoiceId}`}>
                      {item.invoiceNumber}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{formatMoney(item.amount, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open ? (
        <Modal title={ar.cash.add} onClose={() => setOpen(false)}>
          <div className="list-stack">
            <Field label={ar.stock.type}>
              <select
                className={inputClassName}
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value as CashMovementInput["type"] })}
              >
                <option value="RECEIPT">{ar.cash.receipt}</option>
                <option value="PAYMENT">{ar.cash.payment}</option>
              </select>
            </Field>
            <Field label={ar.cash.date}>
              <input
                className={inputClassName}
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </Field>
            <Field label={ar.cash.amount}>
              <input
                className={inputClassName}
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })}
              />
            </Field>
            <Field label={ar.cash.method}>
              <select
                className={inputClassName}
                value={form.paymentMethod}
                onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as PaymentMethod })}
              >
                <option value="CASH">{ar.invoices.cash}</option>
                <option value="CARD">{ar.invoices.card}</option>
                <option value="TRANSFER">{ar.invoices.transfer}</option>
                <option value="OTHER">{ar.invoices.other}</option>
              </select>
            </Field>
            <Field label={ar.cash.description}>
              <input
                className={inputClassName}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </Field>
            <div className="page-actions">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {ar.common.cancel}
              </Button>
              <Button onClick={handleSave}>{ar.common.save}</Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </Page>
  );
}
