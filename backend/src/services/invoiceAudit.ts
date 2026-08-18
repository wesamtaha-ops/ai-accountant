import { InvoiceStatus, InvoiceType, type Invoice } from "@prisma/client";
import {
  auditCalculations,
  auditDuplicate,
  auditPrices,
  computeSafetyScore,
  type AuditFinding,
} from "../accounting/auditEngine.js";
import { explainAuditFindingsWithGemini } from "../ai/invoiceReview.js";
import { prisma } from "../lib/prisma.js";
import { toNumber } from "../lib/serialize.js";

export async function runInvoiceAudit(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lines: true },
  });

  if (!invoice) {
    return null;
  }

  const [settings, products, duplicate] = await Promise.all([
    prisma.setting.findFirst(),
    prisma.product.findMany(),
    findDuplicate(invoice),
  ]);

  const productMap = new Map(
    products.map((product) => [
      product.id,
      {
        name: product.name,
        expectedPurchasePrice: toNumber(product.expectedPurchasePrice),
        expectedSalePrice: toNumber(product.expectedSalePrice),
      },
    ]),
  );

  const lines = invoice.lines.map((line) => ({
    id: line.id,
    productId: line.productId,
    productName: line.productName,
    quantity: toNumber(line.quantity),
    unitPrice: toNumber(line.unitPrice),
    discount: toNumber(line.discount),
    lineTotalStated: toNumber(line.lineTotalStated),
    lineTotalComputed: toNumber(line.lineTotalComputed),
  }));

  const findings: AuditFinding[] = [
    ...auditCalculations({
      lines,
      subtotalStated: toNumber(invoice.subtotalStated),
      subtotalComputed: toNumber(invoice.subtotalComputed),
      totalStated: toNumber(invoice.totalStated),
      totalComputed: toNumber(invoice.totalComputed),
    }),
    ...auditPrices({
      lines,
      products: productMap,
      tolerancePercent: toNumber(settings?.priceTolerancePercent),
      kind: invoice.type === InvoiceType.PURCHASE ? "purchase" : "sale",
    }),
    ...auditDuplicate({
      hasDuplicate: Boolean(duplicate),
      invoiceNumber: invoice.invoiceNumber,
      amount: toNumber(invoice.totalStated),
    }),
  ];

  const safetyScore = computeSafetyScore(findings);
  const review = await explainAuditFindingsWithGemini(findings);
  const nextStatus = nextInvoiceStatus(invoice.status, findings);

  await prisma.$transaction(async (tx) => {
    await tx.invoiceAudit.deleteMany({ where: { invoiceId: invoice.id } });
    if (findings.length > 0) {
      await tx.invoiceAudit.createMany({
        data: findings.map((finding) => ({
          invoiceId: invoice.id,
          type: finding.type,
          severity: finding.severity,
          field: finding.field,
          lineId: finding.lineId,
          invoiceValue: finding.invoiceValue,
          expectedValue: finding.expectedValue,
          message: finding.message,
        })),
      });
    }

    await tx.invoiceAiReview.upsert({
      where: { invoiceId: invoice.id },
      create: {
        invoiceId: invoice.id,
        summary: review.summary,
        recommendation: review.recommendation,
      },
      update: {
        summary: review.summary,
        recommendation: review.recommendation,
      },
    });

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        safetyScore,
        status: nextStatus,
      },
    });
  });

  return findings;
}

async function findDuplicate(invoice: Invoice) {
  const dayStart = new Date(invoice.date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  return prisma.invoice.findFirst({
    where: {
      id: { not: invoice.id },
      invoiceNumber: invoice.invoiceNumber,
      type: invoice.type,
      customerId: invoice.customerId,
      supplierId: invoice.supplierId,
      date: {
        gte: dayStart,
        lt: dayEnd,
      },
      totalStated: invoice.totalStated,
    },
  });
}

function nextInvoiceStatus(current: InvoiceStatus, findings: AuditFinding[]): InvoiceStatus {
  if (current === InvoiceStatus.APPROVED || current === InvoiceStatus.REJECTED) {
    return current;
  }

  return findings.length > 0 ? InvoiceStatus.NEEDS_REVIEW : InvoiceStatus.DRAFT;
}
