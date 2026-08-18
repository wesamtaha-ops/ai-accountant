import { Prisma } from "@prisma/client";
import { Router } from "express";
import { checkPriceDeviation, expectedProfitMargin } from "../accounting/priceCheck.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { parseProductPayload } from "../lib/productPayload.js";
import { prisma } from "../lib/prisma.js";
import { serializeProduct, toNumber } from "../lib/serialize.js";

export const productsRouter = Router();

productsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({
      orderBy: { name: "asc" },
    });

    res.json(products.map(toProductResponse));
  }),
);

productsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: routeId(req.params.id) },
    });

    if (!product) {
      throw new HttpError(404, "المادة غير موجودة");
    }

    res.json(toProductResponse(product));
  }),
);

productsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = parseProductPayload(req.body);

    try {
      const product = await prisma.product.create({ data: payload });
      res.status(201).json(toProductResponse(product));
    } catch (error) {
      throw uniqueSkuOr(error);
    }
  }),
);

productsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const payload = parseProductPayload(req.body);

    try {
      const product = await prisma.product.update({
        where: { id: routeId(req.params.id) },
        data: payload,
      });
      res.json(toProductResponse(product));
    } catch (error) {
      throw uniqueSkuOr(error);
    }
  }),
);

productsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: routeId(req.params.id) },
      include: {
        _count: {
          select: { invoiceLines: true, stockMovements: true },
        },
      },
    });

    if (!product) {
      throw new HttpError(404, "المادة غير موجودة");
    }

    if (product._count.invoiceLines > 0 || product._count.stockMovements > 0) {
      throw new HttpError(409, "لا يمكن حذف مادة مرتبطة بفواتير أو حركات مخزون");
    }

    await prisma.product.delete({ where: { id: product.id } });
    res.status(204).send();
  }),
);

productsRouter.post(
  "/:id/price-check",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: routeId(req.params.id) },
    });

    if (!product) {
      throw new HttpError(404, "المادة غير موجودة");
    }

    const settings = await prisma.setting.findFirst();
    const kind = req.body?.kind === "sale" ? "sale" : "purchase";
    const invoicePrice = Number(req.body?.invoicePrice);

    if (!Number.isFinite(invoicePrice) || invoicePrice < 0) {
      throw new HttpError(400, "سعر الفاتورة يجب أن يكون رقماً صالحاً");
    }

    const expectedPrice =
      kind === "purchase"
        ? toNumber(product.expectedPurchasePrice)
        : toNumber(product.expectedSalePrice);

    res.json(
      checkPriceDeviation({
        expectedPrice,
        invoicePrice,
        tolerancePercent: toNumber(settings?.priceTolerancePercent),
        kind,
      }),
    );
  }),
);

function toProductResponse(product: {
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
  const serialized = serializeProduct(product);
  const stockQuantity = serialized.stockQuantity;
  const minStockLevel = serialized.minStockLevel;

  return {
    ...serialized,
    expectedMarginPercent: expectedProfitMargin(
      serialized.expectedPurchasePrice,
      serialized.expectedSalePrice,
    ),
    isLowStock: stockQuantity <= minStockLevel,
  };
}

function uniqueSkuOr(error: unknown): HttpError {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new HttpError(409, "رمز المادة مستخدم مسبقاً");
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return new HttpError(404, "المادة غير موجودة");
  }

  if (error instanceof HttpError) {
    return error;
  }

  return new HttpError(500, "تعذر حفظ المادة");
}

function routeId(value: string | string[] | undefined): string {
  const id = Array.isArray(value) ? value[0] : value;
  if (!id) {
    throw new HttpError(400, "معرف المادة مطلوب");
  }
  return id;
}
