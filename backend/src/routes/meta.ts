import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { toNumber } from "../lib/serialize.js";

export const metaRouter = Router();

metaRouter.get("/stats", async (_req, res) => {
  const [
    products,
    customers,
    suppliers,
    invoices,
    invoiceLines,
    stockMovements,
    cashMovements,
    expenses,
    audits,
    insights,
    settings,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.customer.count(),
    prisma.supplier.count(),
    prisma.invoice.count(),
    prisma.invoiceLine.count(),
    prisma.stockMovement.count(),
    prisma.cashMovement.count(),
    prisma.expense.count(),
    prisma.invoiceAudit.count(),
    prisma.aiInsight.count(),
    prisma.setting.findFirst(),
  ]);

  const [needsReview, approved, draft, rejected] = await Promise.all([
    prisma.invoice.count({ where: { status: "NEEDS_REVIEW" } }),
    prisma.invoice.count({ where: { status: "APPROVED" } }),
    prisma.invoice.count({ where: { status: "DRAFT" } }),
    prisma.invoice.count({ where: { status: "REJECTED" } }),
  ]);

  res.json({
    companyName: settings?.companyName ?? "",
    currency: settings?.currency ?? "EUR",
    priceTolerancePercent: toNumber(settings?.priceTolerancePercent),
    counts: {
      products,
      customers,
      suppliers,
      invoices,
      invoiceLines,
      stockMovements,
      cashMovements,
      expenses,
      audits,
      insights,
    },
    invoiceStatuses: {
      draft,
      needsReview,
      approved,
      rejected,
    },
  });
});
