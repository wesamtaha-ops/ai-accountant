import { InvoiceStatus, InvoiceType, PaymentMethod, PaymentStatus, StockMovementType } from "@prisma/client";
import { roundQty } from "../accounting/money.js";
import { HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { toNumber } from "../lib/serialize.js";
import { runInvoiceAudit } from "./invoiceAudit.js";

export async function approveInvoice(invoiceId: string) {
  await runInvoiceAudit(invoiceId);

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lines: true,
      auditResults: true,
      stockMovements: true,
    },
  });

  if (!invoice) {
    throw new HttpError(404, "الفاتورة غير موجودة");
  }

  if (invoice.status === InvoiceStatus.APPROVED || invoice.stockMovements.length > 0) {
    throw new HttpError(409, "هذه الفاتورة معتمدة مسبقاً");
  }

  if (invoice.status === InvoiceStatus.REJECTED) {
    throw new HttpError(409, "لا يمكن اعتماد فاتورة مرفوضة");
  }

  const hasCalculationError = invoice.auditResults.some((item) => item.type === "CALCULATION_ERROR");
  if (hasCalculationError) {
    throw new HttpError(409, "لا يمكن اعتماد الفاتورة قبل تصحيح الأخطاء الحسابية");
  }

  const planned: Array<{
    product: { id: string; name: string };
    quantity: number;
    isPurchase: boolean;
    next: number;
  }> = [];
  const runningBalances = new Map<string, number>();

  for (const line of invoice.lines) {
    if (!line.productId) {
      continue;
    }

    const product = await prisma.product.findUnique({ where: { id: line.productId } });
    if (!product) {
      throw new HttpError(400, `المادة ${line.productName} غير موجودة`);
    }

    const quantity = toNumber(line.quantity);
    const current = runningBalances.get(product.id) ?? toNumber(product.stockQuantity);
    const isPurchase = invoice.type === InvoiceType.PURCHASE;
    const next = roundQty(current + (isPurchase ? quantity : -quantity));

    if (!isPurchase && next < 0) {
      throw new HttpError(409, `المخزون غير كافٍ للمادة «${product.name}». المتوفر ${current} والمطلوب ${quantity}.`);
    }

    runningBalances.set(product.id, next);
    planned.push({ product, quantity, isPurchase, next });
  }

  await prisma.$transaction(async (tx) => {
    for (const item of planned) {
      await tx.product.update({
        where: { id: item.product.id },
        data: { stockQuantity: item.next },
      });

      await tx.stockMovement.create({
        data: {
          date: invoice.date,
          productId: item.product.id,
          type: item.isPurchase ? StockMovementType.IN : StockMovementType.OUT,
          invoiceId: invoice.id,
          quantityIn: item.isPurchase ? item.quantity : 0,
          quantityOut: item.isPurchase ? 0 : item.quantity,
          balanceAfter: item.next,
          notes: item.isPurchase ? "دخول من فاتورة شراء معتمدة" : "خروج من فاتورة بيع معتمدة",
        },
      });
    }

    if (invoice.paymentStatus === PaymentStatus.PAID) {
      await tx.cashMovement.create({
        data: {
          date: invoice.date,
          type: invoice.type === InvoiceType.SALE ? "RECEIPT" : "PAYMENT",
          amount: toNumber(invoice.totalComputed),
          invoiceId: invoice.id,
          description:
            invoice.type === InvoiceType.SALE
              ? `قبض فاتورة بيع ${invoice.invoiceNumber}`
              : `دفع فاتورة شراء ${invoice.invoiceNumber}`,
          paymentMethod: invoice.paymentMethod ?? PaymentMethod.CASH,
        },
      });
    }

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.APPROVED,
        approvedAt: new Date(),
      },
    });
  });
}

export async function rejectInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { stockMovements: true },
  });

  if (!invoice) {
    throw new HttpError(404, "الفاتورة غير موجودة");
  }

  if (invoice.status === InvoiceStatus.APPROVED || invoice.stockMovements.length > 0) {
    throw new HttpError(409, "لا يمكن رفض فاتورة معتمدة");
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: InvoiceStatus.REJECTED },
  });
}
