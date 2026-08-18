import type { InvoiceStatus, InvoiceType, PaymentStatus } from "../../api/client";
import { Badge } from "../ui/Badge";
import { ar } from "../../locales/ar";

const statusTone: Record<InvoiceStatus, "muted" | "warn" | "ok" | "danger"> = {
  DRAFT: "muted",
  NEEDS_REVIEW: "warn",
  APPROVED: "ok",
  REJECTED: "danger",
};

const statusLabel: Record<InvoiceStatus, string> = {
  DRAFT: ar.stats.draft,
  NEEDS_REVIEW: ar.stats.needsReview,
  APPROVED: ar.stats.approved,
  REJECTED: ar.stats.rejected,
};

const typeLabel: Record<InvoiceType, string> = {
  SALE: ar.lists.sale,
  PURCHASE: ar.lists.purchase,
};

const paymentLabel: Record<PaymentStatus, string> = {
  UNPAID: ar.invoices.unpaid,
  PAID: ar.invoices.paid,
  PARTIAL: ar.invoices.partial,
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>;
}

export function invoiceTypeLabel(type: InvoiceType): string {
  return typeLabel[type];
}

export function paymentStatusLabel(status: PaymentStatus): string {
  return paymentLabel[status];
}
