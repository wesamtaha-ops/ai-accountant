import { HttpError } from "./http.js";

export type ProductPayload = {
  sku: string;
  name: string;
  category: string;
  unit: string;
  expectedPurchasePrice: number;
  expectedSalePrice: number;
  stockQuantity: number;
  minStockLevel: number;
};

export function parseProductPayload(body: unknown): ProductPayload {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "بيانات المادة غير صالحة");
  }

  const data = body as Record<string, unknown>;

  return {
    sku: requiredText(data.sku, "رمز المادة"),
    name: requiredText(data.name, "اسم المادة"),
    category: requiredText(data.category, "التصنيف"),
    unit: requiredText(data.unit, "وحدة القياس"),
    expectedPurchasePrice: requiredNumber(data.expectedPurchasePrice, "سعر الشراء المتوقع"),
    expectedSalePrice: requiredNumber(data.expectedSalePrice, "سعر البيع المتوقع"),
    stockQuantity: requiredNumber(data.stockQuantity, "الكمية الموجودة"),
    minStockLevel: requiredNumber(data.minStockLevel, "الحد الأدنى للمخزون"),
  };
}

export function parseSettingsPayload(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "بيانات الإعدادات غير صالحة");
  }

  const data = body as Record<string, unknown>;

  return {
    companyName: requiredText(data.companyName, "اسم الشركة"),
    currency: requiredText(data.currency, "العملة"),
    priceTolerancePercent: requiredNumber(data.priceTolerancePercent, "نسبة السماح"),
    defaultTaxPercent: requiredNumber(data.defaultTaxPercent, "نسبة الضريبة الافتراضية"),
    openingCashBalance: requiredNumber(data.openingCashBalance, "الرصيد الافتتاحي للصندوق"),
  };
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, `${label} مطلوب`);
  }

  return value.trim();
}

function requiredNumber(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new HttpError(400, `${label} يجب أن يكون رقماً صفر أو أكبر`);
  }

  return parsed;
}
