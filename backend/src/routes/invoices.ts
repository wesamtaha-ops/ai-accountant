import { InvoiceStatus, InvoiceType } from "@prisma/client";
import { Router } from "express";
import { computeInvoiceTotals } from "../accounting/invoiceMath.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { parseInvoicePayload } from "../lib/invoicePayload.js";
import { prisma } from "../lib/prisma.js";
import { serializeInvoiceDetail, serializeInvoiceSummary, suggestInvoiceNumber } from "../lib/serialize.js";
import { routeId } from "../lib/validation.js";
import { asObject, optionalText } from "../lib/validation.js";
import { approveInvoice, rejectInvoice } from "../services/invoiceApproval.js";
import { runInvoiceAudit } from "../services/invoiceAudit.js";
import { previewInvoiceDraft, readUploadedInvoice, type PreviewDraft } from "../services/invoiceRead.js";

export const invoicesRouter = Router();

const invoiceInclude = {
  customer: true,
  supplier: true,
  lines: true,
  auditResults: true,
  aiReview: true,
} as const;

invoicesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const type = req.query.type === "SALE" || req.query.type === "PURCHASE" ? req.query.type : undefined;
    const status = isStatus(req.query.status) ? req.query.status : undefined;
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const invoices = await prisma.invoice.findMany({
      where: {
        type,
        status,
        OR: query
          ? [
              { invoiceNumber: { contains: query, mode: "insensitive" } },
              { customer: { name: { contains: query, mode: "insensitive" } } },
              { supplier: { name: { contains: query, mode: "insensitive" } } },
            ]
          : undefined,
      },
      orderBy: { date: "desc" },
      include: invoiceInclude,
    });

    res.json(invoices.map(serializeInvoiceSummary));
  }),
);

invoicesRouter.get(
  "/next-number",
  asyncHandler(async (req, res) => {
    const type = req.query.type === InvoiceType.PURCHASE ? InvoiceType.PURCHASE : InvoiceType.SALE;
    const year = new Date().getUTCFullYear();
    const count = await prisma.invoice.count({
      where: {
        type,
        date: {
          gte: new Date(`${year}-01-01T00:00:00.000Z`),
        },
      },
    });

    res.json({ invoiceNumber: suggestInvoiceNumber(type, year, count) });
  }),
);

invoicesRouter.post(
  "/read",
  asyncHandler(async (req, res) => {
    const data = asObject(req.body, "بيانات القراءة غير صالحة");
    res.json(
      await readUploadedInvoice({
        fileName: optionalText(data.fileName) ?? undefined,
        mimeType: optionalText(data.mimeType) ?? undefined,
        contentBase64: optionalText(data.contentBase64) ?? undefined,
        scenario: optionalText(data.scenario) ?? undefined,
      }),
    );
  }),
);

invoicesRouter.post(
  "/preview",
  asyncHandler(async (req, res) => {
    res.json(await previewInvoiceDraft(req.body as PreviewDraft));
  }),
);

invoicesRouter.post(
  "/compute",
  asyncHandler(async (req, res) => {
    const payload = parseInvoicePayload({
      ...req.body,
      invoiceNumber: req.body?.invoiceNumber || "TEMP",
      date: req.body?.date || new Date().toISOString().slice(0, 10),
      customerId: req.body?.customerId || "temp-customer",
      supplierId: req.body?.supplierId || "temp-supplier",
    });

    res.json(
      computeInvoiceTotals(payload.lines, payload.discount, payload.tax),
    );
  }),
);

invoicesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: routeId(req.params.id) },
      include: invoiceInclude,
    });

    if (!invoice) {
      throw new HttpError(404, "الفاتورة غير موجودة");
    }

    res.json(serializeInvoiceDetail(invoice));
  }),
);

invoicesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = parseInvoicePayload(req.body);
    await assertPartyExists(payload.type, payload.customerId, payload.supplierId);
    const totals = computeInvoiceTotals(payload.lines, payload.discount, payload.tax);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: payload.invoiceNumber,
        type: payload.type,
        date: payload.date,
        customerId: payload.customerId,
        supplierId: payload.supplierId,
        status: InvoiceStatus.DRAFT,
        paymentStatus: payload.paymentStatus,
        paymentMethod: payload.paymentMethod,
        notes: payload.notes,
        source: payload.source,
        originalFileUrl: payload.originalFileUrl,
        discountStated: totals.discountStated,
        taxStated: totals.taxStated,
        subtotalStated: totals.subtotalStated,
        totalStated: payload.statedTotal ?? totals.totalStated,
        discountComputed: totals.discountComputed,
        taxComputed: totals.taxComputed,
        subtotalComputed: totals.subtotalComputed,
        totalComputed: totals.totalComputed,
        lines: {
          create: totals.lines,
        },
      },
    });

    res.status(201).json(serializeInvoiceDetail(await auditAndReload(invoice.id)));
  }),
);

invoicesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const current = await prisma.invoice.findUnique({
      where: { id: routeId(req.params.id) },
    });

    if (!current) {
      throw new HttpError(404, "الفاتورة غير موجودة");
    }

    if (current.status === InvoiceStatus.APPROVED) {
      throw new HttpError(409, "لا يمكن تعديل فاتورة معتمدة");
    }

    const payload = parseInvoicePayload(req.body);
    await assertPartyExists(payload.type, payload.customerId, payload.supplierId);
    const totals = computeInvoiceTotals(payload.lines, payload.discount, payload.tax);

    const invoice = await prisma.$transaction(async (tx) => {
      await tx.invoiceLine.deleteMany({ where: { invoiceId: current.id } });
      return tx.invoice.update({
        where: { id: current.id },
        data: {
          invoiceNumber: payload.invoiceNumber,
          type: payload.type,
          date: payload.date,
          customerId: payload.customerId,
          supplierId: payload.supplierId,
          paymentStatus: payload.paymentStatus,
          paymentMethod: payload.paymentMethod,
          notes: payload.notes,
          source: payload.source,
          originalFileUrl: payload.originalFileUrl,
          discountStated: totals.discountStated,
          taxStated: totals.taxStated,
          subtotalStated: totals.subtotalStated,
          totalStated: payload.statedTotal ?? totals.totalStated,
          discountComputed: totals.discountComputed,
          taxComputed: totals.taxComputed,
          subtotalComputed: totals.subtotalComputed,
          totalComputed: totals.totalComputed,
          lines: {
            create: totals.lines,
          },
        },
      });
    });

    res.json(serializeInvoiceDetail(await auditAndReload(invoice.id)));
  }),
);

invoicesRouter.post(
  "/:id/audit",
  asyncHandler(async (req, res) => {
    const id = routeId(req.params.id);
    const current = await prisma.invoice.findUnique({ where: { id } });
    if (!current) {
      throw new HttpError(404, "الفاتورة غير موجودة");
    }

    res.json(serializeInvoiceDetail(await auditAndReload(id)));
  }),
);

invoicesRouter.post(
  "/:id/approve",
  asyncHandler(async (req, res) => {
    await approveInvoice(routeId(req.params.id));
    res.json(serializeInvoiceDetail(await reloadInvoice(routeId(req.params.id))));
  }),
);

invoicesRouter.post(
  "/:id/reject",
  asyncHandler(async (req, res) => {
    await rejectInvoice(routeId(req.params.id));
    res.json(serializeInvoiceDetail(await reloadInvoice(routeId(req.params.id))));
  }),
);

invoicesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: routeId(req.params.id) },
    });

    if (!invoice) {
      throw new HttpError(404, "الفاتورة غير موجودة");
    }

    if (invoice.status === InvoiceStatus.APPROVED) {
      throw new HttpError(409, "لا يمكن حذف فاتورة معتمدة");
    }

    await prisma.invoice.delete({ where: { id: invoice.id } });
    res.status(204).send();
  }),
);

async function assertPartyExists(
  type: InvoiceType,
  customerId: string | null,
  supplierId: string | null,
) {
  if (type === InvoiceType.SALE && customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new HttpError(400, "العميل غير موجود");
    }
  }

  if (type === InvoiceType.PURCHASE && supplierId) {
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      throw new HttpError(400, "المورد غير موجود");
    }
  }
}

async function auditAndReload(invoiceId: string) {
  await runInvoiceAudit(invoiceId);
  return reloadInvoice(invoiceId);
}

async function reloadInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: invoiceInclude,
  });

  if (!invoice) {
    throw new HttpError(404, "الفاتورة غير موجودة");
  }

  return invoice;
}

function isStatus(value: unknown): value is InvoiceStatus {
  return (
    value === InvoiceStatus.DRAFT ||
    value === InvoiceStatus.NEEDS_REVIEW ||
    value === InvoiceStatus.APPROVED ||
    value === InvoiceStatus.REJECTED
  );
}
