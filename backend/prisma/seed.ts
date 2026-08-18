import {
  InvoiceSource,
  InvoiceStatus,
  InvoiceType,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  type CashMovementType,
  type InsightImportance,
  type PaymentMethod as PaymentMethodType,
  type StockMovementType,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type InvoiceDraft = {
  id: string;
  invoiceNumber: string;
  type: InvoiceType;
  date: string;
  customerId?: string;
  supplierId?: string;
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethodType;
  notes?: string;
  source?: InvoiceSource;
  safetyScore?: number;
  lines: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    statedLineTotal?: number;
  }>;
  statedTotalOverride?: number;
};

function money(quantity: number, unitPrice: number, discount = 0): number {
  return round(quantity * unitPrice - discount);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function atNoon(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`);
}

async function main() {
  await resetDatabase();

  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.user.create({
    data: {
      id: "user-admin",
      name: "جعفر الأحمد",
      email: "admin@jaafar.local",
      passwordHash,
    },
  });

  await prisma.setting.create({
    data: {
      id: "settings-main",
      companyName: "مؤسسة جعفر للمواد الغذائية",
      currency: "EUR",
      priceTolerancePercent: 10,
      defaultTaxPercent: 0,
      openingCashBalance: 8500,
    },
  });

  await prisma.product.createMany({
    data: [
      product("prod-coffee-arabic", "CAF-AR-1KG", "قهوة عربية 1 كغ", "قهوة", "كيس", 10, 15, 80, 15),
      product("prod-espresso", "CAF-ES-1KG", "قهوة إسبريسو 1 كغ", "قهوة", "كيس", 12, 18, 45, 12),
      product("prod-tea", "TEA-RD-500", "شاي أحمر 500غ", "مشروبات", "علبة", 4, 7, 70, 20),
      product("prod-sugar", "STAP-SG-1KG", "سكر أبيض 1 كغ", "أساسيات", "كيس", 1.2, 2, 90, 25),
      product("prod-milk", "DAI-ML-1L", "حليب كامل 1 لتر", "ألبان", "علبة", 1.1, 1.8, 36, 18),
      product("prod-olive", "OIL-OL-1L", "زيت زيتون 1 لتر", "زيوت", "زجاجة", 8, 12, 28, 8),
      product("prod-flour", "STAP-FL-1KG", "طحين أبيض 1 كغ", "أساسيات", "كيس", 0.9, 1.5, 75, 20),
      product("prod-honey", "SWT-HN-500", "عسل طبيعي 500غ", "حلويات", "مرطبان", 6, 10, 22, 8),
      product("prod-dates", "SWT-DT-1KG", "تمر فاخر 1 كغ", "حلويات", "كيس", 5, 8, 20, 6),
      product("prod-cocoa", "CAF-CC-250", "كاكاو بودرة 250غ", "قهوة", "علبة", 3.5, 6, 24, 8),
      product("prod-cardamom", "SPC-CD-100", "هيل حب 100غ", "بهارات", "كيس", 7, 11, 18, 6),
      product("prod-rosewater", "FLV-RW-250", "ماء ورد 250مل", "نكهات", "زجاجة", 2.5, 4.5, 16, 6),
    ],
  });

  await prisma.supplier.createMany({
    data: [
      party("sup-reef", "شركة الريف للمؤن", "+49 30 111 2001", "reef@suppliers.example", "برلين"),
      party("sup-med", "مستوردات البحر المتوسط", "+49 40 222 3002", "med@suppliers.example", "هامبورغ"),
      party("sup-mountain", "مزارع الجبل الأخضر", "+49 89 333 4003", "mountain@suppliers.example", "ميونخ"),
      party("sup-noor", "تجارة النور والتوابل", "+49 69 444 5004", "noor@suppliers.example", "فرانكفورت"),
      party("sup-sham", "مورد الشام الذهبي", "+49 221 555 6005", "sham@suppliers.example", "كولونيا"),
    ],
  });

  await prisma.customer.createMany({
    data: [
      party("cus-dar", "مقهى الدار", "+49 30 700 1001", "dar@customers.example", "برلين"),
      party("cus-andalus", "كافيه الأندلس", "+49 40 700 1002", "andalus@customers.example", "هامبورغ"),
      party("cus-bait", "مطعم البيت الشامي", "+49 89 700 1003", "bait@customers.example", "ميونخ"),
      party("cus-hay", "بقالة الحي", "+49 69 700 1004", "hay@customers.example", "فرانكفورت"),
      party("cus-oasis", "فندق الواحة", "+49 221 700 1005", "oasis@customers.example", "كولونيا"),
      party("cus-clock", "مقهى الساعة", "+49 711 700 1006", "clock@customers.example", "شتوتغارت"),
      party("cus-damascus", "حلويات دمشق", "+49 211 700 1007", "damascus@customers.example", "دوسلدورف"),
      party("cus-palm", "سوبرماركت النخيل", "+49 351 700 1008", "palm@customers.example", "دريسدن"),
      party("cus-uni", "كافتيريا الجامعة", "+49 551 700 1009", "uni@customers.example", "غوتنغن"),
      party("cus-specialty", "ركن القهوة المختصة", "+49 30 700 1010", "specialty@customers.example", "برلين"),
    ],
  });

  const invoices = buildInvoices();
  const products = await prisma.product.findMany();
  const productMap = new Map(products.map((item) => [item.id, item]));

  for (const invoice of invoices) {
    const computedLines = invoice.lines.map((line) => {
      const product = productMap.get(line.productId);
      const computed = money(line.quantity, line.unitPrice);
      return {
        productId: line.productId,
        productName: product?.name ?? line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: 0,
        tax: 0,
        lineTotalComputed: computed,
        lineTotalStated: line.statedLineTotal ?? computed,
      };
    });

    const subtotalComputed = round(computedLines.reduce((sum, line) => sum + line.lineTotalComputed, 0));
    const subtotalStated = round(computedLines.reduce((sum, line) => sum + line.lineTotalStated, 0));
    const totalComputed = subtotalComputed;
    const totalStated = invoice.statedTotalOverride ?? subtotalStated;

    await prisma.invoice.create({
      data: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        type: invoice.type,
        date: atNoon(invoice.date),
        customerId: invoice.customerId,
        supplierId: invoice.supplierId,
        status: invoice.status,
        paymentStatus: invoice.paymentStatus,
        paymentMethod: invoice.paymentMethod,
        notes: invoice.notes,
        source: invoice.source ?? InvoiceSource.MANUAL,
        safetyScore: invoice.safetyScore ?? (invoice.status === InvoiceStatus.APPROVED ? 96 : 74),
        discountStated: 0,
        taxStated: 0,
        subtotalStated,
        totalStated,
        discountComputed: 0,
        taxComputed: 0,
        subtotalComputed,
        totalComputed,
        approvedAt: invoice.status === InvoiceStatus.APPROVED ? atNoon(invoice.date) : null,
        lines: {
          create: computedLines,
        },
      },
    });
  }

  await seedAuditAndReviews();
  await seedMovementsAndBalances();
  await seedExpenses();
  await seedInsights();

  const counts = {
    products: await prisma.product.count(),
    customers: await prisma.customer.count(),
    suppliers: await prisma.supplier.count(),
    invoices: await prisma.invoice.count(),
    lines: await prisma.invoiceLine.count(),
    stock: await prisma.stockMovement.count(),
    cash: await prisma.cashMovement.count(),
    expenses: await prisma.expense.count(),
    audits: await prisma.invoiceAudit.count(),
  };

  console.log("Seed completed:", counts);
}

function product(
  id: string,
  sku: string,
  name: string,
  category: string,
  unit: string,
  buy: number,
  sell: number,
  stock: number,
  min: number,
) {
  return {
    id,
    sku,
    name,
    category,
    unit,
    expectedPurchasePrice: buy,
    expectedSalePrice: sell,
    stockQuantity: stock,
    minStockLevel: min,
  };
}

function party(id: string, name: string, phone: string, email: string, address: string) {
  return { id, name, phone, email, address };
}

function sale(
  id: string,
  number: string,
  date: string,
  customerId: string,
  lines: InvoiceDraft["lines"],
  extras: Partial<InvoiceDraft> = {},
): InvoiceDraft {
  return {
    id,
    invoiceNumber: number,
    type: InvoiceType.SALE,
    date,
    customerId,
    status: InvoiceStatus.APPROVED,
    paymentStatus: PaymentStatus.PAID,
    paymentMethod: PaymentMethod.CASH,
    lines,
    ...extras,
  };
}

function purchase(
  id: string,
  number: string,
  date: string,
  supplierId: string,
  lines: InvoiceDraft["lines"],
  extras: Partial<InvoiceDraft> = {},
): InvoiceDraft {
  return {
    id,
    invoiceNumber: number,
    type: InvoiceType.PURCHASE,
    date,
    supplierId,
    status: InvoiceStatus.APPROVED,
    paymentStatus: PaymentStatus.PAID,
    paymentMethod: PaymentMethod.TRANSFER,
    lines,
    ...extras,
  };
}

function buildInvoices(): InvoiceDraft[] {
  return [
    // مارس
    purchase("inv-p-01", "PUR-2026-031", "2026-03-03", "sup-reef", [
      { productId: "prod-coffee-arabic", quantity: 40, unitPrice: 10 },
      { productId: "prod-tea", quantity: 30, unitPrice: 4 },
      { productId: "prod-sugar", quantity: 50, unitPrice: 1.2 },
    ]),
    purchase("inv-p-02", "PUR-2026-032", "2026-03-12", "sup-med", [
      { productId: "prod-espresso", quantity: 20, unitPrice: 12 },
      { productId: "prod-olive", quantity: 16, unitPrice: 8 },
      { productId: "prod-cocoa", quantity: 12, unitPrice: 3.5 },
    ]),
    purchase("inv-p-03", "PUR-2026-033", "2026-03-21", "sup-noor", [
      { productId: "prod-cardamom", quantity: 10, unitPrice: 7 },
      { productId: "prod-rosewater", quantity: 12, unitPrice: 2.5 },
      { productId: "prod-honey", quantity: 10, unitPrice: 6 },
    ]),
    sale("inv-s-01", "SAL-2026-031", "2026-03-06", "cus-dar", [
      { productId: "prod-coffee-arabic", quantity: 8, unitPrice: 15 },
      { productId: "prod-cardamom", quantity: 3, unitPrice: 11 },
      { productId: "prod-sugar", quantity: 10, unitPrice: 2 },
    ]),
    sale("inv-s-02", "SAL-2026-032", "2026-03-11", "cus-andalus", [
      { productId: "prod-espresso", quantity: 6, unitPrice: 18 },
      { productId: "prod-cocoa", quantity: 4, unitPrice: 6 },
      { productId: "prod-milk", quantity: 12, unitPrice: 1.8 },
    ]),
    sale("inv-s-03", "SAL-2026-033", "2026-03-17", "cus-bait", [
      { productId: "prod-olive", quantity: 5, unitPrice: 12 },
      { productId: "prod-flour", quantity: 20, unitPrice: 1.5 },
      { productId: "prod-dates", quantity: 6, unitPrice: 8 },
    ]),
    sale("inv-s-04", "SAL-2026-034", "2026-03-22", "cus-specialty", [
      { productId: "prod-coffee-arabic", quantity: 10, unitPrice: 15 },
      { productId: "prod-honey", quantity: 4, unitPrice: 10 },
      { productId: "prod-rosewater", quantity: 3, unitPrice: 4.5 },
    ]),
    sale("inv-s-05", "SAL-2026-035", "2026-03-28", "cus-oasis", [
      { productId: "prod-tea", quantity: 8, unitPrice: 7 },
      { productId: "prod-dates", quantity: 5, unitPrice: 8 },
      { productId: "prod-sugar", quantity: 15, unitPrice: 2 },
    ]),

    // أبريل
    purchase("inv-p-04", "PUR-2026-041", "2026-04-02", "sup-mountain", [
      { productId: "prod-honey", quantity: 14, unitPrice: 6 },
      { productId: "prod-dates", quantity: 12, unitPrice: 5 },
      { productId: "prod-flour", quantity: 40, unitPrice: 0.9 },
    ]),
    purchase("inv-p-05", "PUR-2026-042", "2026-04-14", "sup-reef", [
      { productId: "prod-coffee-arabic", quantity: 35, unitPrice: 10.2 },
      { productId: "prod-milk", quantity: 24, unitPrice: 1.1 },
      { productId: "prod-sugar", quantity: 40, unitPrice: 1.2 },
    ]),
    purchase("inv-p-06", "PUR-2026-043", "2026-04-24", "sup-sham", [
      { productId: "prod-cardamom", quantity: 8, unitPrice: 7.4 },
      { productId: "prod-tea", quantity: 20, unitPrice: 4 },
    ]),
    sale("inv-s-06", "SAL-2026-041", "2026-04-05", "cus-clock", [
      { productId: "prod-coffee-arabic", quantity: 7, unitPrice: 15 },
      { productId: "prod-tea", quantity: 6, unitPrice: 7 },
    ]),
    sale("inv-s-07", "SAL-2026-042", "2026-04-10", "cus-hay", [
      { productId: "prod-sugar", quantity: 20, unitPrice: 2 },
      { productId: "prod-flour", quantity: 15, unitPrice: 1.5 },
      { productId: "prod-milk", quantity: 10, unitPrice: 1.8 },
    ]),
    sale("inv-s-08", "SAL-2026-043", "2026-04-16", "cus-damascus", [
      { productId: "prod-honey", quantity: 6, unitPrice: 10 },
      { productId: "prod-dates", quantity: 8, unitPrice: 8 },
      { productId: "prod-rosewater", quantity: 4, unitPrice: 4.5 },
    ]),
    sale("inv-s-09", "SAL-2026-044", "2026-04-21", "cus-uni", [
      { productId: "prod-espresso", quantity: 5, unitPrice: 18 },
      { productId: "prod-cocoa", quantity: 5, unitPrice: 6 },
      { productId: "prod-milk", quantity: 16, unitPrice: 1.8 },
    ]),
    sale("inv-s-10", "SAL-2026-045", "2026-04-27", "cus-palm", [
      { productId: "prod-olive", quantity: 6, unitPrice: 12 },
      { productId: "prod-flour", quantity: 18, unitPrice: 1.5 },
      { productId: "prod-sugar", quantity: 12, unitPrice: 2 },
    ]),
    sale("inv-s-11", "SAL-2026-046", "2026-04-30", "cus-dar", [
      { productId: "prod-coffee-arabic", quantity: 9, unitPrice: 15 },
      { productId: "prod-cardamom", quantity: 2, unitPrice: 11 },
    ]),

    // مايو
    purchase("inv-p-07", "PUR-2026-051", "2026-05-04", "sup-med", [
      { productId: "prod-espresso", quantity: 18, unitPrice: 12.3 },
      { productId: "prod-olive", quantity: 14, unitPrice: 8.2 },
      { productId: "prod-cocoa", quantity: 10, unitPrice: 3.6 },
    ]),
    purchase("inv-p-08", "PUR-2026-052", "2026-05-15", "sup-noor", [
      { productId: "prod-cardamom", quantity: 10, unitPrice: 8.2 },
      { productId: "prod-rosewater", quantity: 10, unitPrice: 2.5 },
    ]),
    purchase("inv-p-09", "PUR-2026-053", "2026-05-26", "sup-reef", [
      { productId: "prod-coffee-arabic", quantity: 30, unitPrice: 10.4 },
      { productId: "prod-tea", quantity: 18, unitPrice: 4.1 },
      { productId: "prod-milk", quantity: 20, unitPrice: 1.15 },
    ]),
    sale("inv-s-12", "SAL-2026-051", "2026-05-07", "cus-andalus", [
      { productId: "prod-espresso", quantity: 7, unitPrice: 18 },
      { productId: "prod-coffee-arabic", quantity: 6, unitPrice: 15 },
    ]),
    sale("inv-s-13", "SAL-2026-052", "2026-05-12", "cus-oasis", [
      { productId: "prod-honey", quantity: 5, unitPrice: 10 },
      { productId: "prod-dates", quantity: 6, unitPrice: 8 },
      { productId: "prod-tea", quantity: 7, unitPrice: 7 },
    ]),
    sale("inv-s-14", "SAL-2026-053", "2026-05-18", "cus-specialty", [
      { productId: "prod-coffee-arabic", quantity: 12, unitPrice: 15 },
      { productId: "prod-cardamom", quantity: 4, unitPrice: 11 },
      { productId: "prod-cocoa", quantity: 3, unitPrice: 6 },
    ]),
    sale("inv-s-15", "SAL-2026-054", "2026-05-23", "cus-bait", [
      { productId: "prod-olive", quantity: 7, unitPrice: 12 },
      { productId: "prod-flour", quantity: 22, unitPrice: 1.5 },
    ]),
    sale("inv-s-16", "SAL-2026-055", "2026-05-29", "cus-clock", [
      { productId: "prod-tea", quantity: 9, unitPrice: 7 },
      { productId: "prod-rosewater", quantity: 5, unitPrice: 4.5 },
      { productId: "prod-sugar", quantity: 8, unitPrice: 2 },
    ]),

    // يونيو — مبيعات منخفضة عمداً
    purchase("inv-p-10", "PUR-2026-061", "2026-06-05", "sup-mountain", [
      { productId: "prod-honey", quantity: 8, unitPrice: 6.2 },
      { productId: "prod-dates", quantity: 8, unitPrice: 5.1 },
    ]),
    purchase("inv-p-11", "PUR-2026-062", "2026-06-18", "sup-sham", [
      { productId: "prod-cardamom", quantity: 6, unitPrice: 9.1 },
      { productId: "prod-flour", quantity: 20, unitPrice: 0.95 },
    ]),
    sale("inv-s-17", "SAL-2026-061", "2026-06-10", "cus-hay", [
      { productId: "prod-sugar", quantity: 8, unitPrice: 2 },
      { productId: "prod-flour", quantity: 6, unitPrice: 1.5 },
    ]),
    sale("inv-s-18", "SAL-2026-062", "2026-06-22", "cus-uni", [
      { productId: "prod-tea", quantity: 3, unitPrice: 7 },
      { productId: "prod-milk", quantity: 6, unitPrice: 1.8 },
    ]),

    // يوليو
    purchase("inv-p-12", "PUR-2026-071", "2026-07-03", "sup-reef", [
      { productId: "prod-coffee-arabic", quantity: 32, unitPrice: 10.6 },
      { productId: "prod-sugar", quantity: 30, unitPrice: 1.25 },
      { productId: "prod-milk", quantity: 18, unitPrice: 1.2 },
    ]),
    purchase("inv-p-13", "PUR-2026-072", "2026-07-14", "sup-med", [
      { productId: "prod-espresso", quantity: 16, unitPrice: 12.6 },
      { productId: "prod-cocoa", quantity: 8, unitPrice: 3.8 },
    ]),
    purchase("inv-p-14", "PUR-2026-073", "2026-07-25", "sup-noor", [
      { productId: "prod-cardamom", quantity: 8, unitPrice: 10.5 },
      { productId: "prod-rosewater", quantity: 8, unitPrice: 2.6 },
    ]),
    sale("inv-s-19", "SAL-2026-071", "2026-07-06", "cus-dar", [
      { productId: "prod-coffee-arabic", quantity: 11, unitPrice: 15 },
      { productId: "prod-cardamom", quantity: 3, unitPrice: 11 },
    ]),
    sale("inv-s-20", "SAL-2026-072", "2026-07-11", "cus-andalus", [
      { productId: "prod-espresso", quantity: 8, unitPrice: 18 },
      { productId: "prod-milk", quantity: 14, unitPrice: 1.8 },
    ]),
    sale("inv-s-21", "SAL-2026-073", "2026-07-16", "cus-palm", [
      { productId: "prod-olive", quantity: 5, unitPrice: 12 },
      { productId: "prod-flour", quantity: 14, unitPrice: 1.5 },
      { productId: "prod-sugar", quantity: 10, unitPrice: 2 },
    ]),
    sale("inv-s-22", "SAL-2026-074", "2026-07-20", "cus-damascus", [
      { productId: "prod-honey", quantity: 5, unitPrice: 10 },
      { productId: "prod-dates", quantity: 7, unitPrice: 8 },
    ]),
    sale("inv-s-23", "SAL-2026-075", "2026-07-24", "cus-specialty", [
      { productId: "prod-coffee-arabic", quantity: 10, unitPrice: 15 },
      { productId: "prod-cocoa", quantity: 4, unitPrice: 6 },
      { productId: "prod-rosewater", quantity: 3, unitPrice: 4.5 },
    ]),
    sale("inv-s-24", "SAL-2026-076", "2026-07-29", "cus-oasis", [
      { productId: "prod-tea", quantity: 8, unitPrice: 7 },
      { productId: "prod-dates", quantity: 4, unitPrice: 8 },
    ]),

    // أغسطس
    purchase("inv-p-15", "PUR-2026-081", "2026-08-04", "sup-reef", [
      { productId: "prod-coffee-arabic", quantity: 28, unitPrice: 10.8 },
      { productId: "prod-tea", quantity: 16, unitPrice: 4.2 },
    ]),
    sale("inv-s-25", "SAL-2026-081", "2026-08-06", "cus-clock", [
      { productId: "prod-coffee-arabic", quantity: 8, unitPrice: 15 },
      { productId: "prod-tea", quantity: 5, unitPrice: 7 },
    ]),
    sale("inv-s-26", "SAL-2026-082", "2026-08-10", "cus-bait", [
      { productId: "prod-olive", quantity: 4, unitPrice: 12 },
      { productId: "prod-flour", quantity: 12, unitPrice: 1.5 },
    ]),
    sale("inv-s-27", "SAL-2026-083", "2026-08-13", "cus-uni", [
      { productId: "prod-espresso", quantity: 4, unitPrice: 18 },
      { productId: "prod-milk", quantity: 10, unitPrice: 1.8 },
      { productId: "prod-cocoa", quantity: 2, unitPrice: 6 },
    ]),
    sale("inv-s-28", "SAL-2026-087", "2026-08-09", "cus-specialty", [
      { productId: "prod-coffee-arabic", quantity: 6, unitPrice: 15 },
      { productId: "prod-honey", quantity: 2, unitPrice: 10 },
    ]),

    // حالات العرض المتعمدة
    purchase(
      "inv-demo-calc",
      "PUR-2026-090",
      "2026-08-14",
      "sup-sham",
      [
        { productId: "prod-sugar", quantity: 10, unitPrice: 5, statedLineTotal: 60 },
        { productId: "prod-flour", quantity: 8, unitPrice: 0.9 },
      ],
      {
        status: InvoiceStatus.NEEDS_REVIEW,
        paymentStatus: PaymentStatus.UNPAID,
        paymentMethod: undefined,
        notes: "فاتورة تجريبية بخطأ حسابي في إجمالي السكر",
        source: InvoiceSource.OCR,
        safetyScore: 58,
        statedTotalOverride: 67.2,
      },
    ),
    purchase(
      "inv-demo-price",
      "PUR-2026-091",
      "2026-08-15",
      "sup-reef",
      [
        { productId: "prod-coffee-arabic", quantity: 12, unitPrice: 13 },
        { productId: "prod-tea", quantity: 10, unitPrice: 4.1 },
      ],
      {
        status: InvoiceStatus.NEEDS_REVIEW,
        paymentStatus: PaymentStatus.UNPAID,
        notes: "سعر القهوة العربية أعلى من السعر المرجعي",
        source: InvoiceSource.OCR,
        safetyScore: 64,
      },
    ),
    purchase(
      "inv-demo-duplicate",
      "PUR-2026-081",
      "2026-08-04",
      "sup-reef",
      [
        { productId: "prod-coffee-arabic", quantity: 28, unitPrice: 10.8 },
        { productId: "prod-tea", quantity: 16, unitPrice: 4.2 },
      ],
      {
        status: InvoiceStatus.NEEDS_REVIEW,
        paymentStatus: PaymentStatus.UNPAID,
        notes: "فاتورة مشابهة لفاتورة شراء معتمدة سابقاً",
        source: InvoiceSource.OCR,
        safetyScore: 61,
      },
    ),
    purchase(
      "inv-demo-cardamom",
      "PUR-2026-092",
      "2026-08-16",
      "sup-noor",
      [{ productId: "prod-cardamom", quantity: 10, unitPrice: 12 }],
      {
        status: InvoiceStatus.APPROVED,
        notes: "ارتفاع غير طبيعي في سعر الهيل مقارنة بالأشهر السابقة",
        safetyScore: 71,
      },
    ),
    sale(
      "inv-draft-1",
      "SAL-2026-084",
      "2026-08-17",
      "cus-hay",
      [
        { productId: "prod-sugar", quantity: 6, unitPrice: 2 },
        { productId: "prod-milk", quantity: 8, unitPrice: 1.8 },
      ],
      {
        status: InvoiceStatus.DRAFT,
        paymentStatus: PaymentStatus.UNPAID,
        paymentMethod: undefined,
        notes: "مسودة فاتورة بيع لم تُراجع بعد",
        safetyScore: 88,
      },
    ),
    sale(
      "inv-rejected-1",
      "SAL-2026-085",
      "2026-08-12",
      "cus-palm",
      [{ productId: "prod-olive", quantity: 3, unitPrice: 12 }],
      {
        status: InvoiceStatus.REJECTED,
        paymentStatus: PaymentStatus.UNPAID,
        paymentMethod: undefined,
        notes: "فاتورة مرفوضة بعد اكتشاف بيانات غير مكتملة",
        safetyScore: 40,
      },
    ),
    sale(
      "inv-unpaid-1",
      "SAL-2026-086",
      "2026-08-08",
      "cus-damascus",
      [
        { productId: "prod-honey", quantity: 3, unitPrice: 10 },
        { productId: "prod-dates", quantity: 4, unitPrice: 8 },
      ],
      {
        paymentStatus: PaymentStatus.UNPAID,
        paymentMethod: PaymentMethod.TRANSFER,
        notes: "فاتورة بيع معتمدة وغير مدفوعة بعد",
      },
    ),
  ];
}

async function seedAuditAndReviews() {
  await prisma.invoiceAudit.createMany({
    data: [
      {
        invoiceId: "inv-demo-calc",
        type: "CALCULATION_ERROR",
        severity: "ERROR",
        field: "lineTotal",
        invoiceValue: 60,
        expectedValue: 50,
        message: "خطأ حسابي في سطر السكر الأبيض: 10 × 5 يجب أن تساوي 50 وليس 60.",
      },
      {
        invoiceId: "inv-demo-calc",
        type: "CALCULATION_ERROR",
        severity: "ERROR",
        field: "total",
        invoiceValue: 67.2,
        expectedValue: 57.2,
        message: "الإجمالي النهائي على الفاتورة لا يطابق الإجمالي المحسوب.",
      },
      {
        invoiceId: "inv-demo-price",
        type: "PRICE_DEVIATION",
        severity: "WARNING",
        field: "unitPrice",
        invoiceValue: 13,
        expectedValue: 10,
        message: "سعر قهوة عربية 1 كغ أعلى من السعر المتوقع بنسبة 30%.",
      },
      {
        invoiceId: "inv-demo-duplicate",
        type: "DUPLICATE",
        severity: "WARNING",
        field: "invoiceNumber",
        invoiceValue: 410.4,
        expectedValue: 410.4,
        message: "يوجد احتمال أن تكون هذه الفاتورة مكررة: نفس الرقم والمورد والتاريخ والمبلغ.",
      },
      {
        invoiceId: "inv-demo-cardamom",
        type: "PRICE_DEVIATION",
        severity: "WARNING",
        field: "unitPrice",
        invoiceValue: 12,
        expectedValue: 7,
        message: "سعر الهيل أعلى من السعر المرجعي بنسبة 71%، مع اتجاه تصاعدي خلال الأشهر الماضية.",
      },
    ],
  });

  await prisma.invoiceAiReview.createMany({
    data: [
      {
        invoiceId: "inv-demo-calc",
        summary: "تم اكتشاف مشكلتين: خطأ حسابي في إجمالي أحد الأسطر، والإجمالي النهائي لا يطابق الحساب الصحيح.",
        recommendation: "يرجى تصحيح إجمالي السطر والإجمالي النهائي قبل اعتماد الفاتورة.",
      },
      {
        invoiceId: "inv-demo-price",
        summary: "سعر المادة «قهوة عربية 1 كغ» أعلى من السعر المعتاد بنسبة 30%.",
        recommendation: "راجع السعر مع المورد أو حدّث السعر المرجعي إذا كان الارتفاع مبرراً.",
      },
      {
        invoiceId: "inv-demo-duplicate",
        summary: "الفاتورة تطابق فاتورة شراء سابقة بنفس الرقم والمورد والتاريخ والمبلغ.",
        recommendation: "تأكد أنها ليست نسخة مكررة قبل الاعتماد حتى لا تُحتسب الكمية والمبلغ مرتين.",
      },
    ],
  });
}

async function seedMovementsAndBalances() {
  const invoices = await prisma.invoice.findMany({
    where: { status: InvoiceStatus.APPROVED },
    include: { lines: true },
    orderBy: { date: "asc" },
  });

  const products = await prisma.product.findMany();
  const balances = new Map(products.map((item) => [item.id, Number(item.stockQuantity)]));

  for (const invoice of invoices) {
    for (const line of invoice.lines) {
      if (!line.productId) {
        continue;
      }

      const current = balances.get(line.productId) ?? 0;
      const quantity = Number(line.quantity);
      const isPurchase = invoice.type === InvoiceType.PURCHASE;
      const next = round(current + (isPurchase ? quantity : -quantity));
      balances.set(line.productId, next);

      await prisma.stockMovement.create({
        data: {
          date: invoice.date,
          productId: line.productId,
          type: (isPurchase ? "IN" : "OUT") as StockMovementType,
          invoiceId: invoice.id,
          quantityIn: isPurchase ? quantity : 0,
          quantityOut: isPurchase ? 0 : quantity,
          balanceAfter: next,
          notes: isPurchase ? "دخول من فاتورة شراء معتمدة" : "خروج من فاتورة بيع معتمدة",
        },
      });
    }

    if (invoice.paymentStatus === PaymentStatus.PAID) {
      await prisma.cashMovement.create({
        data: {
          date: invoice.date,
          type: (invoice.type === InvoiceType.SALE ? "RECEIPT" : "PAYMENT") as CashMovementType,
          amount: Number(invoice.totalComputed),
          invoiceId: invoice.id,
          description:
            invoice.type === InvoiceType.SALE
              ? `قبض فاتورة بيع ${invoice.invoiceNumber}`
              : `دفع فاتورة شراء ${invoice.invoiceNumber}`,
          paymentMethod: invoice.paymentMethod ?? PaymentMethod.CASH,
        },
      });
    }
  }

  for (const [productId, stockQuantity] of balances) {
    await prisma.product.update({
      where: { id: productId },
      data: { stockQuantity },
    });
  }
}

async function seedExpenses() {
  const rows = [
    ["2026-03-01", 800, "إيجار", "إيجار المستودع لشهر مارس"],
    ["2026-03-18", 140, "نقل", "أجور نقل طلبيات مارس"],
    ["2026-04-01", 800, "إيجار", "إيجار المستودع لشهر أبريل"],
    ["2026-04-20", 95, "كهرباء", "فاتورة الكهرباء لشهر أبريل"],
    ["2026-05-01", 800, "إيجار", "إيجار المستودع لشهر مايو"],
    ["2026-05-16", 160, "نقل", "أجور نقل طلبيات مايو"],
    ["2026-06-01", 800, "إيجار", "إيجار المستودع لشهر يونيو"],
    ["2026-06-19", 120, "كهرباء", "فاتورة الكهرباء لشهر يونيو"],
    ["2026-07-01", 800, "إيجار", "إيجار المستودع لشهر يوليو"],
    ["2026-07-21", 175, "نقل", "أجور نقل طلبيات يوليو"],
    ["2026-08-01", 800, "إيجار", "إيجار المستودع لشهر أغسطس"],
    ["2026-08-11", 90, "تعبئة", "مواد تغليف وتعبئة"],
  ] as const;

  await prisma.expense.createMany({
    data: rows.map(([date, amount, category, description]) => ({
      date: atNoon(date),
      amount,
      category,
      description,
    })),
  });

  for (const [date, amount, category, description] of rows) {
    await prisma.cashMovement.create({
      data: {
        date: atNoon(date),
        type: "PAYMENT",
        amount,
        description: `${category}: ${description}`,
        paymentMethod: PaymentMethod.TRANSFER,
      },
    });
  }
}

async function seedInsights() {
  const rows: Array<{
    observation: string;
    importance: InsightImportance;
    explanation: string;
    suggestedAction: string;
  }> = [
    {
      observation: "انخفضت المبيعات بشكل واضح في يونيو مقارنة بالأشهر المجاورة.",
      importance: "HIGH",
      explanation: "عدد فواتير البيع وحجمها في يونيو أقل بكثير من مايو ويوليو.",
      suggestedAction: "راجع أسباب التراجع وجهّز عرضاً ترويجياً للشهر القادم.",
    },
    {
      observation: "المادة «قهوة عربية 1 كغ» تحقق أعلى هامش ربح بين المواد.",
      importance: "MEDIUM",
      explanation: "سعر الشراء المتوقع 10 يورو وسعر البيع 15 يورو، أي هامش 50%.",
      suggestedAction: "حافظ على توفر المخزون وركّز على بيع هذه المادة للعملاء الكبار.",
    },
    {
      observation: "أسعار مورد «تجارة النور والتوابل» للهيل ارتفعت خلال الأشهر الثلاثة الماضية.",
      importance: "HIGH",
      explanation: "انتقل سعر شراء الهيل من 7 يورو إلى 12 يورو بين مارس وأغسطس.",
      suggestedAction: "قارن السعر مع مورد بديل أو حدّث سعر البيع المرجعي.",
    },
  ];

  await prisma.aiInsight.createMany({ data: rows });
}

async function resetDatabase() {
  await prisma.invoiceAiReview.deleteMany();
  await prisma.invoiceAudit.deleteMany();
  await prisma.aiInsight.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.cashMovement.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
