import { CashMovementType, PaymentMethod } from "@prisma/client";
import { Router } from "express";
import { roundMoney } from "../accounting/money.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { toNumber } from "../lib/serialize.js";
import { asObject, requiredNumber, requiredText } from "../lib/validation.js";

export const stockRouter = Router();
export const cashRouter = Router();

stockRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
    const movements = await prisma.stockMovement.findMany({
      where: productId ? { productId } : undefined,
      orderBy: { date: "desc" },
      include: {
        product: true,
        invoice: true,
      },
    });

    res.json(
      movements.map((item) => ({
        id: item.id,
        date: item.date,
        productId: item.productId,
        productName: item.product.name,
        type: item.type,
        invoiceId: item.invoiceId,
        invoiceNumber: item.invoice?.invoiceNumber ?? null,
        quantityIn: toNumber(item.quantityIn),
        quantityOut: toNumber(item.quantityOut),
        balanceAfter: toNumber(item.balanceAfter),
        notes: item.notes,
      })),
    );
  }),
);

cashRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [settings, movements] = await Promise.all([
      prisma.setting.findFirst(),
      prisma.cashMovement.findMany({
        orderBy: { date: "desc" },
        include: { invoice: true },
      }),
    ]);

    const openingBalance = roundMoney(toNumber(settings?.openingCashBalance));
    const receipts = roundMoney(
      movements
        .filter((item) => item.type === CashMovementType.RECEIPT)
        .reduce((sum, item) => sum + toNumber(item.amount), 0),
    );
    const payments = roundMoney(
      movements
        .filter((item) => item.type === CashMovementType.PAYMENT)
        .reduce((sum, item) => sum + toNumber(item.amount), 0),
    );

    res.json({
      openingBalance,
      receipts,
      payments,
      currentBalance: roundMoney(openingBalance + receipts - payments),
      movements: movements.map((item) => ({
        id: item.id,
        date: item.date,
        type: item.type,
        amount: toNumber(item.amount),
        invoiceId: item.invoiceId,
        invoiceNumber: item.invoice?.invoiceNumber ?? null,
        description: item.description,
        paymentMethod: item.paymentMethod,
      })),
    });
  }),
);

cashRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = asObject(req.body, "بيانات حركة الصندوق غير صالحة");
    const type = data.type === CashMovementType.RECEIPT ? CashMovementType.RECEIPT : CashMovementType.PAYMENT;
    const paymentMethod = parsePaymentMethod(data.paymentMethod);
    const dateText = requiredText(data.date, "التاريخ");
    const date = new Date(`${dateText}T12:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      throw new HttpError(400, "تاريخ الحركة غير صالح");
    }

    const movement = await prisma.cashMovement.create({
      data: {
        date,
        type,
        amount: requiredNumber(data.amount, "المبلغ"),
        description: requiredText(data.description, "البيان"),
        paymentMethod,
      },
      include: { invoice: true },
    });

    res.status(201).json({
      id: movement.id,
      date: movement.date,
      type: movement.type,
      amount: toNumber(movement.amount),
      invoiceId: movement.invoiceId,
      invoiceNumber: movement.invoice?.invoiceNumber ?? null,
      description: movement.description,
      paymentMethod: movement.paymentMethod,
    });
  }),
);

function parsePaymentMethod(value: unknown): PaymentMethod {
  if (
    value === PaymentMethod.CASH ||
    value === PaymentMethod.CARD ||
    value === PaymentMethod.TRANSFER ||
    value === PaymentMethod.OTHER
  ) {
    return value;
  }

  return PaymentMethod.CASH;
}
