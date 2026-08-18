import type { InsightImportance } from "@prisma/client";
import type { AnalyticsFacts } from "../services/analyticsFacts.js";
import { generateGeminiJson, isGeminiConfigured } from "./geminiClient.js";

export type WrittenInsight = {
  observation: string;
  importance: InsightImportance;
  explanation: string;
  suggestedAction: string;
};

export function writeInsightsFromFacts(facts: AnalyticsFacts): WrittenInsight[] {
  const insights: WrittenInsight[] = [];

  if (Math.abs(facts.purchaseChangePercent) >= 5) {
    const direction = facts.purchaseChangePercent >= 0 ? "ارتفعت" : "انخفضت";
    insights.push({
      observation: `${direction} تكلفة المشتريات بنسبة ${abs(facts.purchaseChangePercent)}% في ${facts.current.label} مقارنة ب${facts.last.label}.`,
      importance: Math.abs(facts.purchaseChangePercent) >= 15 ? "HIGH" : "MEDIUM",
      explanation: `مشتريات ${facts.last.label}: ${money(facts.last.purchases)} ${facts.currency}. مشتريات ${facts.current.label}: ${money(facts.current.purchases)} ${facts.currency}. الرقم محسوب من فواتير الشراء المعتمدة فقط.`,
      suggestedAction:
        facts.purchaseChangePercent >= 0
          ? "راجع فواتير الموردين وقارن الأسعار المرجعية قبل اعتماد المشتريات الجديدة."
          : "تأكد أن انخفاض المشتريات لا يؤدي إلى نقص في المخزون.",
    });
  }

  if (facts.topMarginProduct.name) {
    insights.push({
      observation: `المادة «${facts.topMarginProduct.name}» تحقق أعلى هامش ربح بين المواد.`,
      importance: "MEDIUM",
      explanation: `سعر الشراء المتوقع ${money(facts.topMarginProduct.buy)} وسعر البيع المتوقع ${money(facts.topMarginProduct.sell)}، أي هامش ${facts.topMarginProduct.marginPercent}%.`,
      suggestedAction: "حافظ على توفر المخزون وركّز على بيع هذه المادة للعملاء الكبار.",
    });
  }

  if (facts.supplierPriceRise) {
    const rise = facts.supplierPriceRise;
    insights.push({
      observation: `أسعار مورد «${rise.supplierName}» لمادة «${rise.productName}» ارتفعت خلال الأشهر الماضية.`,
      importance: "HIGH",
      explanation: `انتقل متوسط سعر الشراء من ${money(rise.fromPrice)} إلى ${money(rise.toPrice)}، أي تغير بنسبة ${signed(rise.percent)}%. الأرقام من فواتير الشراء المعتمدة.`,
      suggestedAction: "قارن السعر مع مورد بديل أو حدّث سعر البيع المرجعي.",
    });
  }

  if (facts.expenseChangePercent > facts.salesChangePercent + 3) {
    insights.push({
      observation: "المصروفات ترتفع بشكل أسرع من المبيعات.",
      importance: "HIGH",
      explanation: `تغير المبيعات ${signed(facts.salesChangePercent)}% مقابل تغير المصاريف ${signed(facts.expenseChangePercent)}% بين ${facts.last.label} و${facts.current.label}.`,
      suggestedAction: "راجع بنود الإيجار والنقل والكهرباء قبل نهاية الشهر.",
    });
  }

  if (facts.declinedProduct && facts.declinedProduct.changePercent <= -10) {
    const item = facts.declinedProduct;
    insights.push({
      observation: `مبيعات المادة «${item.name}» انخفضت مقارنة بالشهر السابق.`,
      importance: "MEDIUM",
      explanation: `الكمية في ${facts.previous.label}: ${item.prevQty}. الكمية في ${facts.last.label}: ${item.lastQty}. التغير: ${signed(item.changePercent)}%.`,
      suggestedAction: "راجع الطلب على هذه المادة أو جهّز عرضاً ترويجياً.",
    });
  }

  if (facts.weakestSalesMonth.sales < facts.last.sales || facts.weakestSalesMonth.key !== facts.current.key) {
    insights.push({
      observation: `أضعف شهر مبيعات في الفترة الأخيرة هو ${facts.weakestSalesMonth.label}.`,
      importance: facts.weakestSalesMonth.label === "يونيو" ? "HIGH" : "LOW",
      explanation: `مبيعات ${facts.weakestSalesMonth.label}: ${money(facts.weakestSalesMonth.sales)} ${facts.currency} مقابل ${money(facts.last.sales)} في ${facts.last.label}.`,
      suggestedAction: "استخدم هذا الشهر كمرجع لمراجعة أسباب التراجع في الطلب.",
    });
  }

  if (facts.lowStock.length > 0) {
    insights.push({
      observation: `هناك ${facts.lowStock.length} مواد عند الحد الأدنى للمخزون أو دونه.`,
      importance: "MEDIUM",
      explanation: facts.lowStock
        .map((item) => `«${item.name}»: ${item.quantity} من أصل حد أدنى ${item.minStockLevel}`)
        .join("، "),
      suggestedAction: "أنشئ فاتورة شراء للمواد الناقصة قبل أن تتوقف المبيعات.",
    });
  }

  return insights;
}

export async function writeInsightsWithGemini(facts: AnalyticsFacts): Promise<WrittenInsight[]> {
  const fallback = writeInsightsFromFacts(facts);
  if (!isGeminiConfigured()) {
    return fallback;
  }

  try {
    const polished = await generateGeminiJson<WrittenInsight[]>(
      `أعد صياغة هذه التحليلات المالية بالعربية للمحاسب.
لا تغيّر أي رقم ولا تضف تحليلاً جديداً. أعد مصفوفة JSON بنفس العناصر والحقول:
observation, importance (HIGH أو MEDIUM أو LOW), explanation, suggestedAction.
المعطيات: ${JSON.stringify(fallback)}`,
    );
    if (!Array.isArray(polished) || polished.length === 0) {
      return fallback;
    }
    return polished.map((item, index) => ({
      observation: item.observation || fallback[index]?.observation || "",
      importance: item.importance === "HIGH" || item.importance === "LOW" ? item.importance : "MEDIUM",
      explanation: item.explanation || fallback[index]?.explanation || "",
      suggestedAction: item.suggestedAction || fallback[index]?.suggestedAction || "",
    }));
  } catch {
    return fallback;
  }
}

function money(value: number) {
  return value.toFixed(2);
}

function abs(value: number) {
  return Math.abs(value).toFixed(1);
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}
