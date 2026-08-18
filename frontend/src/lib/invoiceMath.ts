export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeLineTotal(quantity: number, unitPrice: number, discount = 0): number {
  return roundMoney(quantity * unitPrice - discount);
}

export function computeInvoiceTotals(
  lines: Array<{ quantity: number; unitPrice: number; discount: number }>,
  discount = 0,
  tax = 0,
) {
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + computeLineTotal(line.quantity, line.unitPrice, line.discount), 0));
  const safeDiscount = roundMoney(discount);
  const safeTax = roundMoney(tax);

  return {
    subtotal,
    discount: safeDiscount,
    tax: safeTax,
    total: roundMoney(subtotal - safeDiscount + safeTax),
  };
}
