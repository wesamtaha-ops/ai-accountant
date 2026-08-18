import { roundMoney, roundQty } from "./money.js";

export type InvoiceLineInput = {
  productId?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotalStated?: number;
};

export type ComputedInvoiceLine = {
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotalComputed: number;
  lineTotalStated: number;
};

export type ComputedInvoiceTotals = {
  lines: ComputedInvoiceLine[];
  subtotalComputed: number;
  discountComputed: number;
  taxComputed: number;
  totalComputed: number;
  subtotalStated: number;
  discountStated: number;
  taxStated: number;
  totalStated: number;
};

export function computeLineTotal(quantity: number, unitPrice: number, discount = 0): number {
  return roundMoney(quantity * unitPrice - discount);
}

export function computeInvoiceTotals(
  lines: InvoiceLineInput[],
  invoiceDiscount = 0,
  invoiceTax?: number,
): ComputedInvoiceTotals {
  const computedLines = lines.map((line) => {
    const quantity = roundQty(line.quantity);
    const unitPrice = roundMoney(line.unitPrice);
    const discount = roundMoney(line.discount);
    const tax = roundMoney(line.tax);
    const lineTotalComputed = computeLineTotal(quantity, unitPrice, discount);
    const lineTotalStated =
      line.lineTotalStated == null ? lineTotalComputed : roundMoney(line.lineTotalStated);

    return {
      productId: line.productId ?? null,
      productName: line.productName,
      quantity,
      unitPrice,
      discount,
      tax,
      lineTotalComputed,
      lineTotalStated,
    };
  });

  const subtotalComputed = roundMoney(
    computedLines.reduce((sum, line) => sum + line.lineTotalComputed, 0),
  );
  const subtotalStated = roundMoney(
    computedLines.reduce((sum, line) => sum + line.lineTotalStated, 0),
  );
  const discountComputed = roundMoney(invoiceDiscount);
  const taxComputed = roundMoney(invoiceTax ?? computedLines.reduce((sum, line) => sum + line.tax, 0));
  const totalComputed = roundMoney(subtotalComputed - discountComputed + taxComputed);
  const totalStated = roundMoney(subtotalStated - discountComputed + taxComputed);

  return {
    lines: computedLines,
    subtotalComputed,
    discountComputed,
    taxComputed,
    totalComputed,
    subtotalStated,
    discountStated: discountComputed,
    taxStated: taxComputed,
    totalStated,
  };
}
