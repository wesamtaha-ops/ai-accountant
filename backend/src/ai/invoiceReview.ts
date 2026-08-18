import { AuditSeverity } from "@prisma/client";
import type { AuditFinding } from "../accounting/auditEngine.js";
import { generateGeminiJson, isGeminiConfigured } from "./geminiClient.js";

export function explainAuditFindings(findings: AuditFinding[]): {
  summary: string;
  recommendation: string;
} {
  if (findings.length === 0) {
    return {
      summary: "لم يكتشف النظام أخطاء حسابية أو اختلافات في الأسعار أو احتمالاً للتكرار.",
      recommendation: "البيانات متسقة مع الحسابات المرجعية. يمكن مراجعة الفاتورة ثم اعتمادها لاحقاً.",
    };
  }

  const errors = findings.filter((item) => item.severity === AuditSeverity.ERROR);
  const warnings = findings.filter((item) => item.severity === AuditSeverity.WARNING);
  const items = findings.map((item, index) => `${index + 1}. ${item.message}`).join("\n");

  const summary = `تم اكتشاف ${findings.length} ${findings.length === 1 ? "مشكلة" : "مشاكل"}: ${errors.length} خطأ حسابي و${warnings.length} تحذير.\n${items}`;

  const recommendation = errors.length
    ? "يرجى تصحيح الأخطاء الحسابية قبل اعتماد الفاتورة. الذكاء الاصطناعي يشرح النتيجة فقط، والأرقام جاءت من المحرك المحاسبي."
    : "يرجى مراجعة التحذيرات قبل الاعتماد، خاصة اختلاف الأسعار أو احتمال التكرار.";

  return { summary, recommendation };
}

export async function explainAuditFindingsWithGemini(findings: AuditFinding[]) {
  const fallback = explainAuditFindings(findings);
  if (!isGeminiConfigured()) {
    return fallback;
  }

  try {
    const polished = await generateGeminiJson<{ summary: string; recommendation: string }>(
      `اشرح نتائج تدقيق فاتورة بالعربية للمحاسب. لا تضف أي رقم غير موجود في المعطيات.
أعد JSON بالحقلين summary و recommendation.
المعطيات:
${JSON.stringify({ findings, fallback })}`,
    );
    return {
      summary: polished.summary || fallback.summary,
      recommendation: polished.recommendation || fallback.recommendation,
    };
  } catch {
    return fallback;
  }
}
