import { AuditIssueType, AuditSeverity } from "@prisma/client";
import { checkPriceDeviation } from "./priceCheck.js";
import { roundMoney } from "./money.js";

export type AuditFinding = {
  type: AuditIssueType;
  severity: AuditSeverity;
  field?: string;
  lineId?: string;
  invoiceValue?: number;
  expectedValue?: number;
  message: string;
};

export type AuditableLine = {
  id?: string;
  productId?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotalStated: number;
  lineTotalComputed: number;
};

export function auditCalculations(input: {
  lines: AuditableLine[];
  subtotalStated: number;
  subtotalComputed: number;
  totalStated: number;
  totalComputed: number;
}): AuditFinding[] {
  const findings: AuditFinding[] = [];

  for (const line of input.lines) {
    if (valuesDiffer(line.lineTotalStated, line.lineTotalComputed)) {
      findings.push({
        type: AuditIssueType.CALCULATION_ERROR,
        severity: AuditSeverity.ERROR,
        field: "lineTotal",
        lineId: line.id,
        invoiceValue: line.lineTotalStated,
        expectedValue: line.lineTotalComputed,
        message: `خطأ حسابي في سطر «${line.productName}»: ${line.quantity} × ${line.unitPrice} يجب أن يساوي ${line.lineTotalComputed} وليس ${line.lineTotalStated}.`,
      });
    }
  }

  if (valuesDiffer(input.subtotalStated, input.subtotalComputed)) {
    findings.push({
      type: AuditIssueType.CALCULATION_ERROR,
      severity: AuditSeverity.ERROR,
      field: "subtotal",
      invoiceValue: input.subtotalStated,
      expectedValue: input.subtotalComputed,
      message: `المجموع قبل الضريبة على الفاتورة ${input.subtotalStated} بينما القيمة الصحيحة ${input.subtotalComputed}.`,
    });
  }

  if (valuesDiffer(input.totalStated, input.totalComputed)) {
    findings.push({
      type: AuditIssueType.CALCULATION_ERROR,
      severity: AuditSeverity.ERROR,
      field: "total",
      invoiceValue: input.totalStated,
      expectedValue: input.totalComputed,
      message: `الإجمالي النهائي على الفاتورة ${input.totalStated} بينما القيمة الصحيحة ${input.totalComputed}.`,
    });
  }

  return findings;
}

export function auditPrices(input: {
  lines: AuditableLine[];
  products: Map<string, { name: string; expectedPurchasePrice: number; expectedSalePrice: number }>;
  tolerancePercent: number;
  kind: "purchase" | "sale";
}): AuditFinding[] {
  const findings: AuditFinding[] = [];

  for (const line of input.lines) {
    if (!line.productId) {
      continue;
    }

    const product = input.products.get(line.productId);
    if (!product) {
      continue;
    }

    const expectedPrice =
      input.kind === "purchase" ? product.expectedPurchasePrice : product.expectedSalePrice;
    const result = checkPriceDeviation({
      expectedPrice,
      invoicePrice: line.unitPrice,
      tolerancePercent: input.tolerancePercent,
      kind: input.kind,
    });

    if (result.exceedsTolerance) {
      findings.push({
        type: AuditIssueType.PRICE_DEVIATION,
        severity: AuditSeverity.WARNING,
        field: "unitPrice",
        lineId: line.id,
        invoiceValue: result.invoicePrice,
        expectedValue: result.expectedPrice,
        message: `المادة «${product.name}»: ${result.message} السعر المتوقع: ${result.expectedPrice}. سعر الفاتورة: ${result.invoicePrice}. الفرق: ${result.percentChange > 0 ? "+" : ""}${result.percentChange}%.`,
      });
    }
  }

  return findings;
}

export function auditDuplicate(input: {
  hasDuplicate: boolean;
  invoiceNumber: string;
  amount: number;
}): AuditFinding[] {
  if (!input.hasDuplicate) {
    return [];
  }

  return [
    {
      type: AuditIssueType.DUPLICATE,
      severity: AuditSeverity.WARNING,
      field: "invoiceNumber",
      invoiceValue: input.amount,
      expectedValue: input.amount,
      message: `يوجد احتمال أن تكون هذه الفاتورة مكررة: نفس الرقم (${input.invoiceNumber}) ونفس الطرف والتاريخ والمبلغ.`,
    },
  ];
}

export function computeSafetyScore(findings: AuditFinding[]): number {
  const errors = findings.filter((item) => item.severity === AuditSeverity.ERROR).length;
  const warnings = findings.filter((item) => item.severity === AuditSeverity.WARNING).length;
  return Math.max(0, Math.min(100, 100 - errors * 20 - warnings * 10));
}

function valuesDiffer(left: number, right: number): boolean {
  return Math.abs(roundMoney(left) - roundMoney(right)) > 0.009;
}
