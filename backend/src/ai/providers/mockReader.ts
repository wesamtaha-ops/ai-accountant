import type { ExtractedInvoice, InvoiceReadRequest, InvoiceReader } from "../invoiceReader.js";
import { resolveReaderScenario } from "../invoiceReader.js";

const scenarios: Record<"demo" | "clean" | "duplicate", ExtractedInvoice> = {
  demo: {
    invoiceNumber: "PUR-2026-092",
    date: "2026-08-18",
    type: "PURCHASE",
    partyName: "تجارة النور والتوابل",
    paymentStatus: "PAID",
    paymentMethod: "CASH",
    notes: "فاتورة مرفوعة للعرض: خطأ في المجموع وسعر أعلى من المرجعي",
    discount: 0,
    tax: 0,
    totalStated: 190,
    lines: [
      { productName: "قهوة عربية 1 كغ", quantity: 10, unitPrice: 13, lineTotalStated: 130 },
      { productName: "أكياس تغليف", quantity: 10, unitPrice: 5, lineTotalStated: 60 },
    ],
  },
  clean: {
    invoiceNumber: "PUR-2026-093",
    date: "2026-08-18",
    type: "PURCHASE",
    partyName: "شركة الريف للمؤن",
    paymentStatus: "PAID",
    paymentMethod: "TRANSFER",
    notes: "فاتورة تجريبية سليمة",
    discount: 0,
    tax: 0,
    lines: [
      { productName: "قهوة عربية 1 كغ", quantity: 8, unitPrice: 10, lineTotalStated: 80 },
      { productName: "شاي أحمر 500غ", quantity: 10, unitPrice: 4, lineTotalStated: 40 },
    ],
  },
  duplicate: {
    invoiceNumber: "PUR-2026-081",
    date: "2026-08-04",
    type: "PURCHASE",
    partyName: "شركة الريف للمؤن",
    paymentStatus: "UNPAID",
    paymentMethod: null,
    notes: "فاتورة مشابهة لفاتورة شراء معتمدة سابقاً",
    discount: 0,
    tax: 0,
    lines: [
      { productName: "قهوة عربية 1 كغ", quantity: 28, unitPrice: 10.8, lineTotalStated: 302.4 },
      { productName: "شاي أحمر 500غ", quantity: 16, unitPrice: 4.2, lineTotalStated: 67.2 },
    ],
  },
};

export class MockInvoiceReader implements InvoiceReader {
  readonly provider = "mock";

  async read(input: InvoiceReadRequest) {
    const scenario = resolveReaderScenario(input);
    const extracted = scenarios[scenario];
    return {
      extracted,
      previewImage: Buffer.from(renderInvoiceSvg(extracted), "utf8"),
      previewExt: "svg",
    };
  }
}

function renderInvoiceSvg(invoice: ExtractedInvoice): string {
  const typeLabel = invoice.type === "SALE" ? "فاتورة بيع" : "فاتورة شراء";
  const rows = invoice.lines
    .map((line, index) => {
      const y = 320 + index * 48;
      const stated = line.lineTotalStated ?? line.quantity * line.unitPrice;
      return `
        <text x="760" y="${y}" text-anchor="end">${escapeXml(line.productName)}</text>
        <text x="480" y="${y}" text-anchor="end">${line.quantity}</text>
        <text x="360" y="${y}" text-anchor="end">${line.unitPrice}</text>
        <text x="200" y="${y}" text-anchor="end">${stated}</text>
      `;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="820" height="1100" viewBox="0 0 820 1100">
  <rect width="820" height="1100" fill="#f8f4ee"/>
  <rect x="40" y="40" width="740" height="1020" fill="#ffffff" stroke="#134e4a" stroke-width="3"/>
  <text x="760" y="100" text-anchor="end" font-size="28" font-family="Tahoma, Arial" fill="#0b3b38">${typeLabel}</text>
  <text x="760" y="140" text-anchor="end" font-size="18" font-family="Tahoma, Arial" fill="#57534e">مؤسسة جعفر للمواد الغذائية</text>
  <text x="760" y="200" text-anchor="end" font-size="18" font-family="Tahoma, Arial">رقم الفاتورة: ${escapeXml(invoice.invoiceNumber)}</text>
  <text x="760" y="232" text-anchor="end" font-size="18" font-family="Tahoma, Arial">التاريخ: ${invoice.date}</text>
  <text x="760" y="264" text-anchor="end" font-size="18" font-family="Tahoma, Arial">الطرف: ${escapeXml(invoice.partyName)}</text>
  <text x="760" y="300" text-anchor="end" font-size="16" font-family="Tahoma, Arial" fill="#78716c">المادة</text>
  <text x="480" y="300" text-anchor="end" font-size="16" font-family="Tahoma, Arial" fill="#78716c">الكمية</text>
  <text x="360" y="300" text-anchor="end" font-size="16" font-family="Tahoma, Arial" fill="#78716c">السعر</text>
  <text x="200" y="300" text-anchor="end" font-size="16" font-family="Tahoma, Arial" fill="#78716c">الإجمالي</text>
  ${rows}
  <text x="760" y="520" text-anchor="end" font-size="20" font-family="Tahoma, Arial">الإجمالي المكتوب: ${invoice.totalStated ?? "—"}</text>
  <text x="760" y="560" text-anchor="end" font-size="16" font-family="Tahoma, Arial" fill="#57534e">${escapeXml(invoice.notes)}</text>
</svg>`;
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
