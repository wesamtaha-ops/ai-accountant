import type {
  Customer,
  Invoice,
  InvoiceAiReview,
  InvoiceAudit,
  InvoiceLine,
  InvoiceType,
  Prisma,
  Supplier,
} from "@prisma/client";

export function toNumber(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value == null) {
    return 0;
  }

  return Number(value);
}

export function serializeProduct(product: {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  expectedPurchasePrice: Prisma.Decimal;
  expectedSalePrice: Prisma.Decimal;
  stockQuantity: Prisma.Decimal;
  minStockLevel: Prisma.Decimal;
}) {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    unit: product.unit,
    expectedPurchasePrice: toNumber(product.expectedPurchasePrice),
    expectedSalePrice: toNumber(product.expectedSalePrice),
    stockQuantity: toNumber(product.stockQuantity),
    minStockLevel: toNumber(product.minStockLevel),
  };
}

export function serializeInvoiceSummary(
  invoice: Invoice & {
    customer: Customer | null;
    supplier: Supplier | null;
    lines: InvoiceLine[];
    auditResults: InvoiceAudit[];
  },
) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    type: invoice.type,
    date: invoice.date,
    status: invoice.status,
    paymentStatus: invoice.paymentStatus,
    paymentMethod: invoice.paymentMethod,
    partyName: invoice.customer?.name ?? invoice.supplier?.name ?? "",
    customerId: invoice.customerId,
    supplierId: invoice.supplierId,
    totalStated: toNumber(invoice.totalStated),
    totalComputed: toNumber(invoice.totalComputed),
    safetyScore: invoice.safetyScore,
    issuesCount: invoice.auditResults.length,
    linesCount: invoice.lines.length,
    editable: invoice.status !== "APPROVED",
  };
}

export function serializeInvoiceDetail(
  invoice: Invoice & {
    customer: Customer | null;
    supplier: Supplier | null;
    lines: InvoiceLine[];
    auditResults: InvoiceAudit[];
    aiReview?: InvoiceAiReview | null;
  },
) {
  return {
    ...serializeInvoiceSummary(invoice),
    notes: invoice.notes,
    source: invoice.source,
    originalFileUrl: invoice.originalFileUrl,
    discountStated: toNumber(invoice.discountStated),
    taxStated: toNumber(invoice.taxStated),
    subtotalStated: toNumber(invoice.subtotalStated),
    discountComputed: toNumber(invoice.discountComputed),
    taxComputed: toNumber(invoice.taxComputed),
    subtotalComputed: toNumber(invoice.subtotalComputed),
    lines: invoice.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      productName: line.productName,
      quantity: toNumber(line.quantity),
      unitPrice: toNumber(line.unitPrice),
      discount: toNumber(line.discount),
      tax: toNumber(line.tax),
      lineTotalStated: toNumber(line.lineTotalStated),
      lineTotalComputed: toNumber(line.lineTotalComputed),
    })),
    auditResults: invoice.auditResults.map((item) => ({
      id: item.id,
      type: item.type,
      severity: item.severity,
      field: item.field,
      lineId: item.lineId,
      invoiceValue: item.invoiceValue == null ? null : toNumber(item.invoiceValue),
      expectedValue: item.expectedValue == null ? null : toNumber(item.expectedValue),
      message: item.message,
    })),
    aiReview: invoice.aiReview
      ? {
          summary: invoice.aiReview.summary,
          recommendation: invoice.aiReview.recommendation,
        }
      : null,
  };
}

export function dateToInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function suggestInvoiceNumber(type: InvoiceType, year: number, count: number): string {
  const prefix = type === "SALE" ? "SAL" : "PUR";
  return `${prefix}-${year}-${String(count + 1).padStart(3, "0")}`;
}
