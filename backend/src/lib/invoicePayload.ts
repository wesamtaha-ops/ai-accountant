import { InvoiceSource, InvoiceType, PaymentMethod, PaymentStatus } from "@prisma/client";
import { HttpError } from "./http.js";
import { asObject, optionalText, requiredNumber, requiredText } from "./validation.js";

export type ParsedInvoiceLine = {
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotalStated?: number;
};

export type ParsedInvoice = {
  invoiceNumber: string;
  type: InvoiceType;
  date: Date;
  customerId: string | null;
  supplierId: string | null;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  notes: string | null;
  source: InvoiceSource;
  originalFileUrl: string | null;
  discount: number;
  tax: number;
  statedTotal?: number;
  lines: ParsedInvoiceLine[];
};

export function parseInvoicePayload(body: unknown): ParsedInvoice {
  const data = asObject(body, "بيانات الفاتورة غير صالحة");
  const type = parseType(data.type);
  const customerId = optionalText(data.customerId);
  const supplierId = optionalText(data.supplierId);

  if (type === InvoiceType.SALE && !customerId) {
    throw new HttpError(400, "يجب اختيار العميل لفاتورة البيع");
  }

  if (type === InvoiceType.PURCHASE && !supplierId) {
    throw new HttpError(400, "يجب اختيار المورد لفاتورة الشراء");
  }

  const lines = parseLines(data.lines);
  if (lines.length === 0) {
    throw new HttpError(400, "يجب إضافة مادة واحدة على الأقل");
  }

  return {
    invoiceNumber: requiredText(data.invoiceNumber, "رقم الفاتورة"),
    type,
    date: parseDate(data.date),
    customerId: type === InvoiceType.SALE ? customerId : null,
    supplierId: type === InvoiceType.PURCHASE ? supplierId : null,
    paymentStatus: parsePaymentStatus(data.paymentStatus),
    paymentMethod: parsePaymentMethod(data.paymentMethod),
    notes: optionalText(data.notes),
    source: data.source === InvoiceSource.OCR ? InvoiceSource.OCR : InvoiceSource.MANUAL,
    originalFileUrl: optionalText(data.originalFileUrl),
    discount: requiredNumber(data.discount ?? 0, "الخصم"),
    tax: requiredNumber(data.tax ?? 0, "الضريبة"),
    statedTotal: data.statedTotal == null || data.statedTotal === "" ? undefined : requiredNumber(data.statedTotal, "الإجمالي المكتوب"),
    lines,
  };
}

function parseLines(value: unknown): ParsedInvoiceLine[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, "تفاصيل الفاتورة غير صالحة");
  }

  return value.map((item, index) => {
    const line = asObject(item, `سطر الفاتورة رقم ${index + 1} غير صالح`);
    return {
      productId: optionalText(line.productId),
      productName: requiredText(line.productName, `اسم المادة في السطر ${index + 1}`),
      quantity: requiredNumber(line.quantity, `الكمية في السطر ${index + 1}`),
      unitPrice: requiredNumber(line.unitPrice, `سعر الوحدة في السطر ${index + 1}`),
      discount: requiredNumber(line.discount ?? 0, `الخصم في السطر ${index + 1}`),
      tax: requiredNumber(line.tax ?? 0, `الضريبة في السطر ${index + 1}`),
      lineTotalStated:
        line.lineTotalStated == null ? undefined : requiredNumber(line.lineTotalStated, "إجمالي السطر"),
    };
  });
}

function parseDate(value: unknown): Date {
  const text = requiredText(value, "تاريخ الفاتورة");
  const date = new Date(`${text}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, "تاريخ الفاتورة غير صالح");
  }
  return date;
}

function parseType(value: unknown): InvoiceType {
  if (value === InvoiceType.SALE || value === InvoiceType.PURCHASE) {
    return value;
  }
  throw new HttpError(400, "نوع الفاتورة غير صالح");
}

function parsePaymentStatus(value: unknown): PaymentStatus {
  if (value === PaymentStatus.UNPAID || value === PaymentStatus.PAID || value === PaymentStatus.PARTIAL) {
    return value;
  }
  return PaymentStatus.UNPAID;
}

function parsePaymentMethod(value: unknown): PaymentMethod | null {
  if (value == null || value === "") {
    return null;
  }
  if (
    value === PaymentMethod.CASH ||
    value === PaymentMethod.CARD ||
    value === PaymentMethod.TRANSFER ||
    value === PaymentMethod.OTHER
  ) {
    return value;
  }
  throw new HttpError(400, "طريقة الدفع غير صالحة");
}
