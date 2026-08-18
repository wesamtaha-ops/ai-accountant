import { InvoiceStatus, InvoiceType } from "@prisma/client";
import { linearRegressionForecast, movingAverageForecast } from "../accounting/forecast.js";
import { roundMoney, roundQty } from "../accounting/money.js";
import { calendarMonthRange, lastMonthsRange, monthKey } from "../lib/dateRange.js";
import { prisma } from "../lib/prisma.js";
import { toNumber } from "../lib/serialize.js";
import { getTrendSeries } from "./reports.js";

export type MonthFacts = {
  key: string;
  label: string;
  sales: number;
  purchases: number;
  expenses: number;
  profit: number;
  payments: number;
};

export type AnalyticsFacts = {
  currency: string;
  current: MonthFacts;
  last: MonthFacts;
  previous: MonthFacts;
  monthly: MonthFacts[];
  purchaseChangePercent: number;
  salesChangePercent: number;
  expenseChangePercent: number;
  topMarginProduct: { name: string; marginPercent: number; buy: number; sell: number };
  supplierPriceRise: {
    supplierName: string;
    productName: string;
    fromPrice: number;
    toPrice: number;
    percent: number;
  } | null;
  declinedProduct: { name: string; lastQty: number; prevQty: number; changePercent: number } | null;
  weakestSalesMonth: MonthFacts;
  cashBalance: number;
  thisMonthPayments: number;
  lastMonthProfit: number;
  forecastNextMonth: {
    profit: number;
    confidence: "LOW" | "MEDIUM" | "HIGH";
    sample: number[];
  };
  lowStock: Array<{ name: string; quantity: number; minStockLevel: number }>;
};

export async function collectAnalyticsFacts(): Promise<AnalyticsFacts> {
  const currentRange = calendarMonthRange(0);
  const lastRange = calendarMonthRange(-1);
  const previousRange = calendarMonthRange(-2);
  const historyRange = lastMonthsRange(6);

  const [settings, trend, products, purchaseLines, saleLines, cashMovements] = await Promise.all([
    prisma.setting.findFirst(),
    getTrendSeries(),
    prisma.product.findMany(),
    loadPurchaseLines(historyRange.from, historyRange.to),
    loadSaleLines(previousRange.from, lastRange.to),
    prisma.cashMovement.findMany(),
  ]);

  const monthly: MonthFacts[] = trend.map((item) => ({
    key: item.month,
    label: item.label,
    sales: item.sales,
    purchases: item.purchases,
    expenses: item.expenses,
    profit: item.profit,
    payments: item.payments,
  }));

  const current = monthFromSeries(monthly, currentRange.key) ?? emptyMonth(currentRange);
  const last = monthFromSeries(monthly, lastRange.key) ?? emptyMonth(lastRange);
  const previous = monthFromSeries(monthly, previousRange.key) ?? emptyMonth(previousRange);

  const topMarginProduct = products
    .map((product) => {
      const buy = toNumber(product.expectedPurchasePrice);
      const sell = toNumber(product.expectedSalePrice);
      return {
        name: product.name,
        buy,
        sell,
        marginPercent: sell > 0 ? roundMoney(((sell - buy) / sell) * 100) : 0,
      };
    })
    .sort((left, right) => right.marginPercent - left.marginPercent)[0] ?? {
    name: "",
    buy: 0,
    sell: 0,
    marginPercent: 0,
  };

  const opening = toNumber(settings?.openingCashBalance);
  const receipts = cashMovements
    .filter((item) => item.type === "RECEIPT")
    .reduce((sum, item) => sum + toNumber(item.amount), 0);
  const payments = cashMovements
    .filter((item) => item.type === "PAYMENT")
    .reduce((sum, item) => sum + toNumber(item.amount), 0);

  const completeMonths = monthly.filter((item) => item.key !== currentRange.key);
  const weakestSalesMonth = [...monthly].sort((left, right) => left.sales - right.sales)[0] ?? current;
  const profitHistory = completeMonths.map((item) => item.profit);
  const forecast = linearRegressionForecast(profitHistory, 1);
  const average = movingAverageForecast(profitHistory);

  return {
    currency: settings?.currency ?? "EUR",
    current,
    last,
    previous,
    monthly,
    purchaseChangePercent: percentChange(last.purchases, current.purchases),
    salesChangePercent: percentChange(last.sales, current.sales),
    expenseChangePercent: percentChange(last.expenses, current.expenses),
    topMarginProduct,
    supplierPriceRise: findSupplierPriceRise(purchaseLines),
    declinedProduct: findDeclinedProduct(saleLines, lastRange.key, previousRange.key),
    weakestSalesMonth,
    cashBalance: roundMoney(opening + receipts - payments),
    thisMonthPayments: current.payments,
    lastMonthProfit: last.profit,
    forecastNextMonth: {
      profit: forecast.estimates[0] ?? average.estimate,
      confidence: forecast.confidence,
      sample: average.sample,
    },
    lowStock: products
      .filter((product) => toNumber(product.stockQuantity) <= toNumber(product.minStockLevel))
      .map((product) => ({
        name: product.name,
        quantity: toNumber(product.stockQuantity),
        minStockLevel: toNumber(product.minStockLevel),
      })),
  };
}

function monthFromSeries(monthly: MonthFacts[], key: string) {
  return monthly.find((item) => item.key === key);
}

function emptyMonth(range: { key: string; label: string }): MonthFacts {
  return { key: range.key, label: range.label, sales: 0, purchases: 0, expenses: 0, profit: 0, payments: 0 };
}

function percentChange(from: number, to: number) {
  if (from === 0) {
    return to === 0 ? 0 : 100;
  }
  return roundMoney(((to - from) / from) * 100);
}

function findSupplierPriceRise(
  lines: Array<{ supplierName: string; productName: string; month: string; unitPrice: number }>,
) {
  const groups = new Map<string, Array<{ month: string; unitPrice: number; supplierName: string; productName: string }>>();

  for (const line of lines) {
    const key = `${line.supplierName}::${line.productName}`;
    const current = groups.get(key) ?? [];
    current.push(line);
    groups.set(key, current);
  }

  let best: AnalyticsFacts["supplierPriceRise"] = null;

  for (const rows of groups.values()) {
    const byMonth = new Map<string, number[]>();
    for (const row of rows) {
      const prices = byMonth.get(row.month) ?? [];
      prices.push(row.unitPrice);
      byMonth.set(row.month, prices);
    }
    const months = Array.from(byMonth.keys()).sort();
    if (months.length < 2) {
      continue;
    }
    const first = average(byMonth.get(months[0]) ?? []);
    const last = average(byMonth.get(months[months.length - 1]) ?? []);
    const percent = percentChange(first, last);
    if (!best || percent > best.percent) {
      best = {
        supplierName: rows[0].supplierName,
        productName: rows[0].productName,
        fromPrice: first,
        toPrice: last,
        percent,
      };
    }
  }

  return best && best.percent >= 10 ? best : null;
}

function findDeclinedProduct(
  lines: Array<{ productName: string; month: string; quantity: number }>,
  lastKey: string,
  prevKey: string,
) {
  const totals = new Map<string, { lastQty: number; prevQty: number }>();

  for (const line of lines) {
    const current = totals.get(line.productName) ?? { lastQty: 0, prevQty: 0 };
    if (line.month === lastKey) current.lastQty = roundQty(current.lastQty + line.quantity);
    if (line.month === prevKey) current.prevQty = roundQty(current.prevQty + line.quantity);
    totals.set(line.productName, current);
  }

  let best: AnalyticsFacts["declinedProduct"] = null;
  for (const [name, qty] of totals) {
    if (qty.prevQty <= 0) {
      continue;
    }
    const changePercent = percentChange(qty.prevQty, qty.lastQty);
    if (changePercent >= 0) {
      continue;
    }
    if (!best || changePercent < best.changePercent) {
      best = { name, lastQty: qty.lastQty, prevQty: qty.prevQty, changePercent };
    }
  }
  return best;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return roundMoney(values.reduce((sum, value) => sum + value, 0) / values.length);
}

async function loadPurchaseLines(from: Date, to: Date) {
  const invoices = await prisma.invoice.findMany({
    where: { status: InvoiceStatus.APPROVED, type: InvoiceType.PURCHASE, date: { gte: from, lt: to } },
    include: { supplier: true, lines: { include: { product: true } } },
  });

  return invoices.flatMap((invoice) =>
    invoice.lines.map((line) => ({
      supplierName: invoice.supplier?.name ?? "",
      productName: line.product?.name ?? line.productName,
      month: monthKey(invoice.date),
      unitPrice: toNumber(line.unitPrice),
    })),
  );
}

async function loadSaleLines(from: Date, to: Date) {
  const invoices = await prisma.invoice.findMany({
    where: { status: InvoiceStatus.APPROVED, type: InvoiceType.SALE, date: { gte: from, lt: to } },
    include: { lines: { include: { product: true } } },
  });

  return invoices.flatMap((invoice) =>
    invoice.lines.map((line) => ({
      productName: line.product?.name ?? line.productName,
      month: monthKey(invoice.date),
      quantity: toNumber(line.quantity),
    })),
  );
}
