import { Router } from "express";
import { asyncHandler, HttpError } from "../lib/http.js";
import { parsePartyPayload } from "../lib/partyPayload.js";
import { prisma } from "../lib/prisma.js";
import { routeId } from "../lib/validation.js";

export const customersRouter = Router();
export const suppliersRouter = Router();

customersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await prisma.customer.findMany({ orderBy: { name: "asc" } }));
  }),
);

customersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const row = await prisma.customer.create({ data: parsePartyPayload(req.body, "العميل") });
    res.status(201).json(row);
  }),
);

customersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    try {
      const row = await prisma.customer.update({
        where: { id: routeId(req.params.id) },
        data: parsePartyPayload(req.body, "العميل"),
      });
      res.json(row);
    } catch {
      throw new HttpError(404, "العميل غير موجود");
    }
  }),
);

customersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = routeId(req.params.id);
    const existing = await prisma.customer.findUnique({
      where: { id },
      include: { _count: { select: { invoices: true } } },
    });

    if (!existing) {
      throw new HttpError(404, "العميل غير موجود");
    }

    if (existing._count.invoices > 0) {
      throw new HttpError(409, "لا يمكن حذف عميل مرتبط بفواتير");
    }

    await prisma.customer.delete({ where: { id } });
    res.status(204).send();
  }),
);

suppliersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await prisma.supplier.findMany({ orderBy: { name: "asc" } }));
  }),
);

suppliersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const row = await prisma.supplier.create({ data: parsePartyPayload(req.body, "المورد") });
    res.status(201).json(row);
  }),
);

suppliersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    try {
      const row = await prisma.supplier.update({
        where: { id: routeId(req.params.id) },
        data: parsePartyPayload(req.body, "المورد"),
      });
      res.json(row);
    } catch {
      throw new HttpError(404, "المورد غير موجود");
    }
  }),
);

suppliersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = routeId(req.params.id);
    const existing = await prisma.supplier.findUnique({
      where: { id },
      include: { _count: { select: { invoices: true } } },
    });

    if (!existing) {
      throw new HttpError(404, "المورد غير موجود");
    }

    if (existing._count.invoices > 0) {
      throw new HttpError(409, "لا يمكن حذف مورد مرتبط بفواتير");
    }

    await prisma.supplier.delete({ where: { id } });
    res.status(204).send();
  }),
);
