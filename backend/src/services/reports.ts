import { CashMovementType, InvoiceStatus, InvoiceType, type CashMovement } from "@prisma/client";
import { computeProfit } from "../accounting/profit.js";
import { roundMoney, roundQty } from "../accounting/money.js";
import { buildMonthKeys, lastMonthsRange, monthKey, monthLabel, type DateRange } from "../lib/dateRange.js";
import { prisma } from "../lib/prisma.js";
import { toNumber } from "../lib/serialize.js";

type ExpenseRow = { date: Date; amount: number };

export async function getDashboard(range: DateRange) {
  const settings = await prisma.setting.findFirst();
  const trendRange = lastMonthsRange(6);

  const [periodInvoices, trendInvoices, expenseRows, trendExpenseRows, cashMovements, products, problemInvoices, invoicesCount] =
    await Promise.all([
      loadApprovedInvoices(range.from, range.to),
      loadApprovedInvoices(trendRange.from, trendRange.to),
      loadExpenseRows(range.from, range.to),
      loadExpenseRows(trendRange.from, trendRange.to),
      prisma.cashMovement.findMany(),
      prisma.product.findMany(),
      prisma.invoice.count({
        where: { status: InvoiceStatus.NEEDS_REVIEW, date: { gte: range.from, lt: range.to } },
      }),
      prisma.invoice.count({
        where: { date: { gte: range.from, lt: range.to } },
      }),
    ]);

  const profit = summarizeInvoices(periodInvoices, sumExpenses(expenseRows));
  const inventoryValue = roundMoney(
    products.reduce((sum, product) => sum + toNumber(product.stockQuantity) * toNumber(product.expectedPurchasePrice), 0),
  );
  const cash = summarizeCash(cashMovements, toNumber(settings?.openingCashBalance));

  return {
    currency: settings?.currency ?? "EUR",
    companyName: settings?.companyName ?? "",
    period: {
      preset: range.preset,
      from: range.from.toISOString().slice(0, 10),
      to: new Date(range.to.getTime() - 1).toISOString().slice(0, 10),
    },
    cards: {
      sales: profit.sales,
      purchases: profit.purchases,
      expenses: profit.expenses,
      netProfit: profit.netProfit,
      marginPercent: profit.marginPercent,
      cashBalance: cash.currentBalance,
      inventoryValue,
      invoicesCount,
      problemInvoices,
    },
    monthly: buildMonthlySeries(trendInvoices, trendExpenseRows, cashMovements, trendRange.from, trendRange.to),
    topProducts: topSellingProducts(periodInvoices),
    lowStock: products
      .filter((product) => toNumber(product.stockQuantity) <= toNumber(product.minStockLevel))
      .map((product) => ({
        id: product.id,
        name: product.name,
        stockQuantity: toNumber(product.stockQuantity),
        minStockLevel: toNumber(product.minStockLevel),
      })),
  };
}

export async function getProfitReport(range: DateRange) {
  const [invoices, expenses] = await Promise.all([
    loadApprovedInvoices(range.from, range.to),
    loadExpenses(range.from, range.to),
  ]);
  return summarizeInvoices(invoices, expenses);
}

export async function getSalesReport(range: DateRange, customerId?: string, productId?: string) {
  const invoices = await loadApprovedInvoices(range.from, range.to, {
    type: InvoiceType.SALE,
    customerId,
  });

  const rows = new Map<
    string,
    { productId: string; productName: string; quantity: number; sales: number; profit: number }
  >();

  for (const invoice of invoices) {
    for (const line of invoice.lines) {
      if (productId && line.productId !== productId) {
        continue;
      }
      const key = line.productId ?? line.productName;
      const current = rows.get(key) ?? {
        productId: line.productId ?? "",
        productName: line.product?.name ?? line.productName,
        quantity: 0,
        sales: 0,
        profit: 0,
      };
      const quantity = toNumber(line.quantity);
      const sales = toNumber(line.lineTotalComputed);
      const cost = quantity * toNumber(line.product?.expectedPurchasePrice);
      current.quantity = roundQty(current.quantity + quantity);
      current.sales = roundMoney(current.sales + sales);
      current.profit = roundMoney(current.profit + (sales - cost));
      rows.set(key, current);
    }
  }

  return Array.from(rows.values()).sort((left, right) => right.sales - left.sales);
}

export async function getTrendSeries() {
  const trendRange = lastMonthsRange(6);
  const [invoices, expenses, cashMovements] = await Promise.all([
    loadApprovedInvoices(trendRange.from, trendRange.to),
    loadExpenseRows(trendRange.from, trendRange.to),
    prisma.cashMovement.findMany(),
  ]);
  return buildMonthlySeries(invoices, expenses, cashMovements, trendRange.from, trendRange.to);
}

export async function getPurchasesReport(range: DateRange, supplierId?: string, productId?: string) {
  const invoices = await loadApprovedInvoices(range.from, range.to, {
    type: InvoiceType.PURCHASE,
    supplierId,
  });

  return invoices.flatMap((invoice) =>
    invoice.lines
      .filter((line) => !productId || line.productId === productId)
      .map((line) => ({
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        supplierName: invoice.supplier?.name ?? "",
        productName: line.product?.name ?? line.productName,
        quantity: toNumber(line.quantity),
        cost: toNumber(line.lineTotalComputed),
      })),
  );
}

function summarizeInvoices(
  invoices: Awaited<ReturnType<typeof loadApprovedInvoices>>,
  expenses: number,
) {
  const sales = invoices
    .filter((invoice) => invoice.type === InvoiceType.SALE)
    .reduce((sum, invoice) => sum + toNumber(invoice.totalComputed), 0);
  const purchases = invoices
    .filter((invoice) => invoice.type === InvoiceType.PURCHASE)
    .reduce((sum, invoice) => sum + toNumber(invoice.totalComputed), 0);
  const cogs = invoices
    .filter((invoice) => invoice.type === InvoiceType.SALE)
    .flatMap((invoice) => invoice.lines)
    .reduce((sum, line) => sum + toNumber(line.quantity) * toNumber(line.product?.expectedPurchasePrice), 0);

  return {
    purchases: roundMoney(purchases),
    ...computeProfit({ sales, cogs, expenses }),
  };
}

function buildMonthlySeries(
  invoices: Awaited<ReturnType<typeof loadApprovedInvoices>>,
  expenses: ExpenseRow[],
  cashMovements: CashMovement[],
  from: Date,
  to: Date,
) {
  const keys = buildMonthKeys(from, to);
  return keys.map((key) => {
    const monthInvoices = invoices.filter((invoice) => monthKey(invoice.date) === key);
    const monthExpenses = expenses
      .filter((item) => monthKey(item.date) === key)
      .reduce((sum, item) => sum + item.amount, 0);
    const profit = summarizeInvoices(monthInvoices, monthExpenses);
    const receipts = cashMovements
      .filter((item) => item.type === CashMovementType.RECEIPT && monthKey(item.date) === key)
      .reduce((sum, item) => sum + toNumber(item.amount), 0);
    const payments = cashMovements
      .filter((item) => item.type === CashMovementType.PAYMENT && monthKey(item.date) === key)
      .reduce((sum, item) => sum + toNumber(item.amount), 0);

    return {
      month: key,
      label: monthLabel(key),
      sales: profit.sales,
      purchases: profit.purchases,
      expenses: profit.expenses,
      profit: profit.netProfit,
      receipts: roundMoney(receipts),
      payments: roundMoney(payments),
    };
  });
}

function topSellingProducts(invoices: Awaited<ReturnType<typeof loadApprovedInvoices>>) {
  const rows = new Map<string, { name: string; quantity: number; sales: number }>();

  for (const invoice of invoices.filter((item) => item.type === InvoiceType.SALE)) {
    for (const line of invoice.lines) {
      const name = line.product?.name ?? line.productName;
      const current = rows.get(name) ?? { name, quantity: 0, sales: 0 };
      current.quantity = roundQty(current.quantity + toNumber(line.quantity));
      current.sales = roundMoney(current.sales + toNumber(line.lineTotalComputed));
      rows.set(name, current);
    }
  }

  return Array.from(rows.values())
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 5);
}

function summarizeCash(movements: CashMovement[], openingBalance: number) {
  const receipts = movements
    .filter((item) => item.type === CashMovementType.RECEIPT)
    .reduce((sum, item) => sum + toNumber(item.amount), 0);
  const payments = movements
    .filter((item) => item.type === CashMovementType.PAYMENT)
    .reduce((sum, item) => sum + toNumber(item.amount), 0);

  return {
    currentBalance: roundMoney(openingBalance + receipts - payments),
  };
}

async function loadApprovedInvoices(
  from: Date,
  to: Date,
  extra: { type?: InvoiceType; customerId?: string; supplierId?: string } = {},
) {
  return prisma.invoice.findMany({
    where: {
      status: InvoiceStatus.APPROVED,
      date: { gte: from, lt: to },
      type: extra.type,
      customerId: extra.customerId,
      supplierId: extra.supplierId,
    },
    include: {
      customer: true,
      supplier: true,
      lines: { include: { product: true } },
    },
    orderBy: { date: "desc" },
  });
}

async function loadExpenseRows(from: Date, to: Date): Promise<ExpenseRow[]> {
  const rows = await prisma.expense.findMany({
    where: { date: { gte: from, lt: to } },
  });
  return rows.map((item) => ({ date: item.date, amount: toNumber(item.amount) }));
}

function sumExpenses(rows: ExpenseRow[]) {
  return roundMoney(rows.reduce((sum, item) => sum + item.amount, 0));
}

async function loadExpenses(from: Date, to: Date) {
  return sumExpenses(await loadExpenseRows(from, to));
}
