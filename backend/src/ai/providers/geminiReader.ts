import { HttpError } from "../../lib/http.js";
import { generateGeminiJson, isGeminiConfigured } from "../geminiClient.js";
import type { ExtractedInvoice, InvoiceReadRequest, InvoiceReader } from "../invoiceReader.js";
import { MockInvoiceReader } from "./mockReader.js";

export class GeminiInvoiceReader implements InvoiceReader {
  readonly provider = "gemini";

  async read(input: InvoiceReadRequest) {
    if (!input.buffer) {
      const mock = await new MockInvoiceReader().read(input);
      return { ...mock, provider: "mock" };
    }

    if (!isGeminiConfigured()) {
      throw new HttpError(503, "لقراءة صورة أو PDF أضف GEMINI_API_KEY في backend/.env ثم أعد تشغيل الخادم.");
    }

    const extracted = await generateGeminiJson<ExtractedInvoice>(extractionPrompt(), {
      mimeType: resolveMime(input.mimeType, input.fileName),
      data: input.buffer.toString("base64"),
    });

    return { extracted: normalizeExtracted(extracted), provider: "gemini" };
  }
}

function extractionPrompt() {
  return `استخرج البيانات المكتوبة على الفاتورة فقط. أعد JSON بهذه الحقول:
invoiceNumber, date (YYYY-MM-DD), type (SALE أو PURCHASE), partyName,
paymentStatus (UNPAID أو PAID أو PARTIAL), paymentMethod (CASH أو CARD أو TRANSFER أو OTHER أو null),
notes, discount, tax, totalStated,
lines: [{ productName, quantity, unitPrice, discount, tax, lineTotalStated }]
لا تحسب أرقاماً جديدة. انقل ما هو مكتوب على الفاتورة فقط. إذا غاب حقل استخدم قيمة فارغة أو صفراً.`;
}

function normalizeExtracted(value: ExtractedInvoice): ExtractedInvoice {
  return {
    invoiceNumber: String(value.invoiceNumber ?? ""),
    date: String(value.date ?? new Date().toISOString().slice(0, 10)),
    type: value.type === "SALE" ? "SALE" : "PURCHASE",
    partyName: String(value.partyName ?? ""),
    paymentStatus:
      value.paymentStatus === "PAID" || value.paymentStatus === "PARTIAL" ? value.paymentStatus : "UNPAID",
    paymentMethod:
      value.paymentMethod === "CASH" ||
      value.paymentMethod === "CARD" ||
      value.paymentMethod === "TRANSFER" ||
      value.paymentMethod === "OTHER"
        ? value.paymentMethod
        : null,
    notes: String(value.notes ?? ""),
    discount: Number(value.discount ?? 0),
    tax: Number(value.tax ?? 0),
    totalStated: value.totalStated == null ? undefined : Number(value.totalStated),
    lines: Array.isArray(value.lines)
      ? value.lines.map((line) => ({
          productName: String(line.productName ?? ""),
          quantity: Number(line.quantity ?? 0),
          unitPrice: Number(line.unitPrice ?? 0),
          discount: Number(line.discount ?? 0),
          tax: Number(line.tax ?? 0),
          lineTotalStated: line.lineTotalStated == null ? undefined : Number(line.lineTotalStated),
        }))
      : [],
  };
}

function resolveMime(mimeType?: string, fileName?: string) {
  if (mimeType && mimeType !== "application/octet-stream") {
    return mimeType;
  }
  const name = (fileName ?? "").toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}
