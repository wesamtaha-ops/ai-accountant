import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type InvoiceStatus, type InvoiceSummary, type InvoiceType } from "../api/client";
import { InvoiceStatusBadge, invoiceTypeLabel } from "../components/invoice/InvoiceStatusBadge";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { inputClassName } from "../components/ui/Field";
import { Page } from "../components/ui/Page";
import { PageHeader } from "../components/ui/PageHeader";
import { formatMoney } from "../lib/format";
import { ar } from "../locales/ar";

export function InvoicesPage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [type, setType] = useState<InvoiceType | "all">("all");
  const [status, setStatus] = useState<InvoiceStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [currency, setCurrency] = useState("EUR");

  async function load() {
    const [rows, settings] = await Promise.all([
      api.invoices({
        type: type === "all" ? undefined : type,
        status: status === "all" ? undefined : status,
        q: query.trim() || undefined,
      }),
      api.settings(),
    ]);
    setInvoices(rows);
    setCurrency(settings.currency);
  }

  useEffect(() => {
    load().catch(() => setError(ar.dashboard.disconnected));
  }, [type, status]);

  async function handleDelete(invoice: InvoiceSummary) {
    if (!invoice.editable || !window.confirm(ar.invoices.confirmDelete)) {
      return;
    }

    try {
      await api.deleteInvoice(invoice.id);
      setNotice(ar.invoices.deleted);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : ar.dashboard.disconnected);
    }
  }

  return (
    <Page>
      <PageHeader
        title={ar.invoices.title}
        subtitle={ar.invoices.subtitle}
        actions={
          <>
            <Button onClick={() => navigate("/invoices/upload")}>{ar.invoices.upload}</Button>
            <Button variant="secondary" onClick={() => navigate("/invoices/new?type=SALE")}>
              {ar.invoices.newSale}
            </Button>
            <Button variant="secondary" onClick={() => navigate("/invoices/new?type=PURCHASE")}>
              {ar.invoices.newPurchase}
            </Button>
          </>
        }
      />

      <div className="toolbar">
        <input
          className={inputClassName}
          placeholder={ar.invoices.searchPlaceholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              load().catch(() => setError(ar.dashboard.disconnected));
            }
          }}
        />
        <select className={inputClassName} value={type} onChange={(event) => setType(event.target.value as InvoiceType | "all")}>
          <option value="all">{ar.common.all}</option>
          <option value="SALE">{ar.lists.sale}</option>
          <option value="PURCHASE">{ar.lists.purchase}</option>
        </select>
        <select
          className={inputClassName}
          value={status}
          onChange={(event) => setStatus(event.target.value as InvoiceStatus | "all")}
        >
          <option value="all">{ar.common.all}</option>
          <option value="DRAFT">{ar.stats.draft}</option>
          <option value="NEEDS_REVIEW">{ar.stats.needsReview}</option>
          <option value="APPROVED">{ar.stats.approved}</option>
          <option value="REJECTED">{ar.stats.rejected}</option>
        </select>
        <Button variant="secondary" onClick={() => load()}>
          {ar.common.search}
        </Button>
      </div>

      {notice ? <Alert tone="ok">{notice}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{ar.invoices.number}</th>
              <th>{ar.invoices.date}</th>
              <th>{ar.invoices.type}</th>
              <th>{ar.invoices.party}</th>
              <th>{ar.invoices.total}</th>
              <th>{ar.invoices.safetyScore}</th>
              <th>{ar.invoices.status}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td className="empty-cell" colSpan={8}>
                  {ar.common.empty}
                </td>
              </tr>
            ) : null}
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td>
                  <Link to={`/invoices/${invoice.id}`} className="link-quiet">
                    {invoice.invoiceNumber}
                  </Link>
                </td>
                <td>{invoice.date.slice(0, 10)}</td>
                <td>{invoiceTypeLabel(invoice.type)}</td>
                <td>{invoice.partyName}</td>
                <td>{formatMoney(invoice.totalComputed, currency)}</td>
                <td>{invoice.safetyScore ?? "—"} / 100</td>
                <td>
                  <InvoiceStatusBadge status={invoice.status} />
                </td>
                <td>
                  <div className="page-actions">
                    <Button variant="secondary" onClick={() => navigate(`/invoices/${invoice.id}`)}>
                      {invoice.editable ? ar.common.edit : ar.common.view}
                    </Button>
                    {invoice.editable ? (
                      <Button variant="ghost" onClick={() => handleDelete(invoice)}>
                        {ar.common.delete}
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
