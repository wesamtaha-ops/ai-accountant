import { InvoiceType, type InvoiceSource } from "@prisma/client";
import {
  auditCalculations,
  auditDuplicate,
  auditPrices,
  computeSafetyScore,
  type AuditFinding,
} from "../accounting/auditEngine.js";
import { computeInvoiceTotals } from "../accounting/invoiceMath.js";
import { explainAuditFindingsWithGemini } from "../ai/invoiceReview.js";
import { createInvoiceReader } from "../ai/createInvoiceReader.js";
import type { ExtractedInvoice } from "../ai/invoiceReader.js";
import { prisma } from "../lib/prisma.js";
import { toNumber } from "../lib/serialize.js";
import { saveUpload } from "../lib/uploads.js";

export type PreviewDraft = {
  invoiceNumber: string;
  type: "SALE" | "PURCHASE";
  date: string;
  customerId?: string | null;
  supplierId?: string | null;
  partyName?: string;
  paymentStatus: "UNPAID" | "PAID" | "PARTIAL";
  paymentMethod?: "CASH" | "CARD" | "TRANSFER" | "OTHER" | null;
  notes?: string | null;
  discount: number;
  tax: number;
  statedTotal?: number;
  originalFileUrl?: string | null;
  source?: InvoiceSource;
  lines: Array<{
    productId?: string | null;
    productName: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    tax: number;
    lineTotalStated?: number;
  }>;
};

export async function readUploadedInvoice(input: {
  fileName?: string;
  mimeType?: string;
  contentBase64?: string;
  scenario?: string;
}) {
  const reader = createInvoiceReader();
  const uploadedBuffer = decodeBase64(input.contentBase64);
  const result = await reader.read({
    fileName: input.fileName,
    mimeType: input.mimeType,
    buffer: uploadedBuffer,
    scenario: input.scenario,
  });

  const previewUrl = uploadedBuffer
    ? await saveUpload(input.fileName ?? "invoice.bin", uploadedBuffer)
    : await saveUpload(`preview.${result.previewExt ?? "svg"}`, result.previewImage ?? Buffer.from(""));

  return buildReadResult(result.extracted, previewUrl, result.provider ?? reader.provider);
}

export async function previewInvoiceDraft(draft: PreviewDraft) {
  return buildReadResult(undefined, draft.originalFileUrl ?? "", "preview", draft);
}

async function buildReadResult(
  extracted: ExtractedInvoice | undefined,
  previewUrl: string,
  provider: string,
  draftOverride?: PreviewDraft,
) {
  const [products, customers, suppliers, settings] = await Promise.all([
    prisma.product.findMany(),
    prisma.customer.findMany(),
    prisma.supplier.findMany(),
    prisma.setting.findFirst(),
  ]);

  const draft = draftOverride ?? matchExtracted(extracted as ExtractedInvoice, products, customers, suppliers);
  const totals = computeInvoiceTotals(draft.lines, draft.discount, draft.tax);
  const statedTotal = draft.statedTotal ?? totals.totalStated;
  const lines = totals.lines.map((line, index) => ({
    ...line,
    id: `line-${index}`,
  }));

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

  const findings: AuditFinding[] = [
    ...auditCalculations({
      lines,
      subtotalStated: totals.subtotalStated,
      subtotalComputed: totals.subtotalComputed,
      totalStated: statedTotal,
      totalComputed: totals.totalComputed,
    }),
    ...auditPrices({
      lines,
      products: productMap,
      tolerancePercent: toNumber(settings?.priceTolerancePercent),
      kind: draft.type === "PURCHASE" ? "purchase" : "sale",
    }),
    ...auditDuplicate({
      hasDuplicate: Boolean(await findDraftDuplicate(draft, statedTotal)),
      invoiceNumber: draft.invoiceNumber,
      amount: statedTotal,
    }),
  ];

  const unmatchedParty = draft.type === "SALE" ? !draft.customerId : !draft.supplierId;
  const unmatchedLines = draft.lines.map((line) => !line.productId);
  const review = await explainAuditFindingsWithGemini(findings);

  return {
    provider,
    previewUrl,
    extracted: extracted ?? null,
    draft: {
      ...draft,
      partyName: draft.partyName ?? extracted?.partyName ?? "",
      statedTotal,
      originalFileUrl: previewUrl,
      source: "OCR" as const,
    },
    computed: {
      subtotal: totals.subtotalComputed,
      total: totals.totalComputed,
      lines: lines.map((line) => ({
        productName: line.productName,
        lineTotalComputed: line.lineTotalComputed,
        lineTotalStated: line.lineTotalStated,
      })),
    },
    auditResults: findings.map((item, index) => ({
      id: `preview-${index}`,
      type: item.type,
      severity: item.severity,
      field: item.field ?? null,
      lineId: item.lineId ?? null,
      invoiceValue: item.invoiceValue ?? null,
      expectedValue: item.expectedValue ?? null,
      message: item.message,
    })),
    aiReview: review,
    safetyScore: computeSafetyScore(findings),
    fieldTones: buildFieldTones(lines, findings, unmatchedParty, unmatchedLines),
    currency: settings?.currency ?? "EUR",
  };
}

function matchExtracted(
  extracted: ExtractedInvoice,
  products: Array<{ id: string; name: string }>,
  customers: Array<{ id: string; name: string }>,
  suppliers: Array<{ id: string; name: string }>,
): PreviewDraft {
  const parties = extracted.type === InvoiceType.SALE ? customers : suppliers;
  const party = findByName(extracted.partyName, parties);

  return {
    invoiceNumber: extracted.invoiceNumber,
    type: extracted.type,
    date: extracted.date,
    customerId: extracted.type === "SALE" ? party?.id ?? null : null,
    supplierId: extracted.type === "PURCHASE" ? party?.id ?? null : null,
    partyName: extracted.partyName,
    paymentStatus: extracted.paymentStatus,
    paymentMethod: extracted.paymentMethod,
    notes: extracted.notes,
    discount: extracted.discount,
    tax: extracted.tax,
    statedTotal: extracted.totalStated,
    source: "OCR",
    lines: extracted.lines.map((line) => {
      const product = findByName(line.productName, products);
      return {
        productId: product?.id ?? null,
        productName: product?.name ?? line.productName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount ?? 0,
        tax: line.tax ?? 0,
        lineTotalStated: line.lineTotalStated,
      };
    }),
  };
}

async function findDraftDuplicate(draft: PreviewDraft, totalStated: number) {
  const date = new Date(`${draft.date}T12:00:00.000Z`);
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  return prisma.invoice.findFirst({
    where: {
      invoiceNumber: draft.invoiceNumber,
      type: draft.type,
      customerId: draft.customerId ?? undefined,
      supplierId: draft.supplierId ?? undefined,
      date: { gte: dayStart, lt: dayEnd },
      totalStated,
    },
  });
}

function buildFieldTones(
  lines: Array<{ id?: string }>,
  findings: AuditFinding[],
  unmatchedParty: boolean,
  unmatchedLines: boolean[],
) {
  type Tone = "ok" | "warn" | "error";
  const lineTones: Array<{ product: Tone; unitPrice: Tone; lineTotal: Tone }> = lines.map((_, index) => ({
    product: unmatchedLines[index] ? "warn" : "ok",
    unitPrice: "ok",
    lineTotal: "ok",
  }));

  let invoiceNumber: "ok" | "warn" | "error" = "ok";
  let total: "ok" | "warn" | "error" = "ok";

  for (const finding of findings) {
    const index = lines.findIndex((line) => line.id && line.id === finding.lineId);
    if (finding.field === "unitPrice" && index >= 0) {
      lineTones[index].unitPrice = "warn";
    }
    if (finding.field === "lineTotal" && index >= 0) {
      lineTones[index].lineTotal = "error";
    }
    if (finding.field === "total" || finding.field === "subtotal") {
      total = "error";
    }
    if (finding.type === "DUPLICATE") {
      invoiceNumber = "warn";
    }
  }

  return {
    invoiceNumber,
    date: "ok" as const,
    party: unmatchedParty ? ("warn" as const) : ("ok" as const),
    total,
    lines: lineTones,
  };
}

function findByName<T extends { id: string; name: string }>(name: string, items: T[]) {
  const needle = normalizeName(name);
  return (
    items.find((item) => normalizeName(item.name) === needle) ??
    items.find((item) => normalizeName(item.name).includes(needle) || needle.includes(normalizeName(item.name)))
  );
}

function normalizeName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase();
}

function decodeBase64(value?: string) {
  if (!value) {
    return undefined;
  }
  return Buffer.from(value, "base64");
}
