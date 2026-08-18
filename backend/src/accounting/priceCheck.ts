import { roundMoney } from "./money.js";

export type PriceKind = "purchase" | "sale";

export type PriceCheckInput = {
  expectedPrice: number;
  invoicePrice: number;
  tolerancePercent: number;
  kind: PriceKind;
};

export type PriceCheckResult = {
  expectedPrice: number;
  invoicePrice: number;
  difference: number;
  percentChange: number;
  tolerancePercent: number;
  exceedsTolerance: boolean;
  direction: "higher" | "lower" | "equal";
  message: string;
};

export function checkPriceDeviation(input: PriceCheckInput): PriceCheckResult {
  const expectedPrice = roundMoney(input.expectedPrice);
  const invoicePrice = roundMoney(input.invoicePrice);
  const tolerancePercent = roundMoney(input.tolerancePercent);
  const difference = roundMoney(invoicePrice - expectedPrice);
  const percentChange = expectedPrice === 0 ? 0 : roundMoney((difference / expectedPrice) * 100);

  const direction = difference > 0 ? "higher" : difference < 0 ? "lower" : "equal";
  const exceedsTolerance = Math.abs(percentChange) > tolerancePercent;
  const priceLabel = input.kind === "purchase" ? "سعر الشراء المتوقع" : "سعر البيع المتوقع";

  let message = `السعر مطابق لـ${priceLabel}.`;

  if (direction !== "equal") {
    const sign = percentChange > 0 ? "+" : "";
    message = exceedsTolerance
      ? `السعر ${direction === "higher" ? "أعلى" : "أقل"} من ${priceLabel} بنسبة ${sign}${percentChange}%.`
      : `يوجد فرق بسيط ضمن نسبة السماح (${sign}${percentChange}%).`;
  }

  return {
    expectedPrice,
    invoicePrice,
    difference,
    percentChange,
    tolerancePercent,
    exceedsTolerance,
    direction,
    message,
  };
}

export function expectedProfitMargin(purchasePrice: number, salePrice: number): number {
  if (purchasePrice <= 0) {
    return 0;
  }

  return roundMoney(((salePrice - purchasePrice) / purchasePrice) * 100);
}
