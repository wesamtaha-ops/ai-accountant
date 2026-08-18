import type { AnalyticsFacts } from "../services/analyticsFacts.js";
import { generateGeminiText, isGeminiConfigured } from "./geminiClient.js";

export type AssistantReply = {
  intent: string;
  answer: string;
  facts: Array<{ label: string; value: string }>;
  source: "database";
};

type Intent =
  | "last_month_profit"
  | "this_month_profit"
  | "this_month_sales"
  | "this_month_payments"
  | "top_margin_product"
  | "supplier_price_rise"
  | "next_month_forecast"
  | "cash_balance"
  | "weakest_month"
  | "unknown";

export async function answerAccountingQuestion(question: string, facts: AnalyticsFacts): Promise<AssistantReply> {
  const intent = detectIntent(question);
  const reply = replies(facts)[intent];
  const base = { ...reply, intent, source: "database" as const };

  if (!isGeminiConfigured()) {
    return base;
  }

  try {
    const answer = await generateGeminiText(
      `أنت مساعد محاسب في نظام جعفر. اشرح السؤال بالعربية في فقرة قصيرة.
استخدم فقط هذه الحقائق المحسوبة من قاعدة البيانات. ممنوع اختراع أي رقم.
السؤال: ${question}
الحقائق: ${JSON.stringify({ intent, facts: reply.facts, fallbackAnswer: reply.answer, currency: facts.currency })}`,
    );
    return { ...base, answer: answer || base.answer };
  } catch {
    return base;
  }
}

export function suggestedQuestions() {
  return [
    "كم ربحت الشهر الماضي؟",
    "ما هي أكثر مادة تحقق هامش ربح؟",
    "أي مورد رفع أسعاره أكثر؟",
    "كم دفعت هذا الشهر؟",
    "ما هي أرباحي المتوقعة الشهر القادم ولماذا؟",
  ];
}

function detectIntent(question: string): Intent {
  const text = normalize(question);
  const scores: Array<{ intent: Intent; score: number }> = [
    { intent: "next_month_forecast", score: scoreOf(text, ["متوقع", "توقعات", "القادم", "المقبل", "التالي"]) },
    { intent: "last_month_profit", score: scoreOf(text, ["الماضي", "السابق"]) + scoreOf(text, ["ربح", "ربحت", "ارباح"]) },
    { intent: "this_month_payments", score: scoreOf(text, ["دفعت", "دفع", "مدفوعات"]) },
    { intent: "top_margin_product", score: scoreOf(text, ["هامش", "اعلي", "اكثر ماده", "افضل ماده"]) },
    { intent: "supplier_price_rise", score: scoreOf(text, ["مورد", "اسعار", "رفع"]) },
    { intent: "this_month_sales", score: scoreOf(text, ["مبيعات"]) },
    { intent: "this_month_profit", score: scoreOf(text, ["ربح", "ربحت", "هذا الشهر"]) },
    { intent: "cash_balance", score: scoreOf(text, ["صندوق", "رصيد"]) },
    { intent: "weakest_month", score: scoreOf(text, ["يونيو", "اضعف", "انخفضت المبيعات"]) },
  ];

  const best = scores.sort((left, right) => right.score - left.score)[0];
  return best && best.score >= 2 ? best.intent : "unknown";
}

function replies(facts: AnalyticsFacts): Record<Intent, Omit<AssistantReply, "intent" | "source">> {
  const rise = facts.supplierPriceRise;
  const confidenceLabel =
    facts.forecastNextMonth.confidence === "HIGH"
      ? "مرتفع"
      : facts.forecastNextMonth.confidence === "MEDIUM"
        ? "متوسط"
        : "منخفض";

  return {
    last_month_profit: {
      answer: `صافي ربح ${facts.last.label} هو ${money(facts.last.profit)} ${facts.currency}. حسبته من المبيعات المعتمدة ناقص تكلفة البضاعة والمصاريف، وليس من تقدير الذكاء الاصطناعي.`,
      facts: [
        { label: "الشهر", value: facts.last.label },
        { label: "المبيعات", value: money(facts.last.sales) },
        { label: "المصاريف", value: money(facts.last.expenses) },
        { label: "صافي الربح", value: money(facts.last.profit) },
      ],
    },
    this_month_profit: {
      answer: `صافي ربح ${facts.current.label} حتى الآن هو ${money(facts.current.profit)} ${facts.currency}.`,
      facts: [
        { label: "المبيعات", value: money(facts.current.sales) },
        { label: "صافي الربح", value: money(facts.current.profit) },
      ],
    },
    this_month_sales: {
      answer: `مبيعات ${facts.current.label} المعتمدة تبلغ ${money(facts.current.sales)} ${facts.currency}.`,
      facts: [{ label: "المبيعات", value: money(facts.current.sales) }],
    },
    this_month_payments: {
      answer: `إجمالي المدفوعات في ${facts.current.label} هو ${money(facts.thisMonthPayments)} ${facts.currency} من حركة الصندوق.`,
      facts: [{ label: "المدفوعات", value: money(facts.thisMonthPayments) }],
    },
    top_margin_product: {
      answer: `أعلى هامش ربح متوقع هو للمادة «${facts.topMarginProduct.name}» بنسبة ${facts.topMarginProduct.marginPercent}% لأن سعر الشراء ${money(facts.topMarginProduct.buy)} وسعر البيع ${money(facts.topMarginProduct.sell)}.`,
      facts: [
        { label: "المادة", value: facts.topMarginProduct.name },
        { label: "هامش الربح", value: `${facts.topMarginProduct.marginPercent}%` },
      ],
    },
    supplier_price_rise: {
      answer: rise
        ? `أكبر ارتفاع في أسعار الشراء كان من مورد «${rise.supplierName}» لمادة «${rise.productName}»: من ${money(rise.fromPrice)} إلى ${money(rise.toPrice)} أي ${signed(rise.percent)}.`
        : "لم يظهر ارتفاع يتجاوز 10% في أسعار الموردين داخل فواتير الشراء المعتمدة.",
      facts: rise
        ? [
            { label: "المورد", value: rise.supplierName },
            { label: "المادة", value: rise.productName },
            { label: "من", value: money(rise.fromPrice) },
            { label: "إلى", value: money(rise.toPrice) },
          ]
        : [],
    },
    next_month_forecast: {
      answer: `الربح المتوقع للشهر القادم هو ${money(facts.forecastNextMonth.profit)} ${facts.currency} بانحدار خطي بسيط من الأشهر المكتملة. مستوى الثقة: ${confidenceLabel}. يمكن فتح صفحة توقع الأرباح لعرض الأشهر الثلاثة.`,
      facts: [
        { label: "التوقع", value: money(facts.forecastNextMonth.profit) },
        { label: "الثقة", value: confidenceLabel },
      ],
    },
    cash_balance: {
      answer: `رصيد الصندوق الحالي ${money(facts.cashBalance)} ${facts.currency} = الرصيد الافتتاحي + المقبوضات − المدفوعات.`,
      facts: [{ label: "رصيد الصندوق", value: money(facts.cashBalance) }],
    },
    weakest_month: {
      answer: `أضعف شهر مبيعات في البيانات المتاحة هو ${facts.weakestSalesMonth.label} بمبيعات ${money(facts.weakestSalesMonth.sales)} ${facts.currency}.`,
      facts: [
        { label: "الشهر", value: facts.weakestSalesMonth.label },
        { label: "المبيعات", value: money(facts.weakestSalesMonth.sales) },
      ],
    },
    unknown: {
      answer:
        "أستطيع شرح الأرقام الموجودة في قاعدة البيانات فقط، ولا أخترع أرقاماً. اسأل مثلاً عن ربح الشهر الماضي، أعلى هامش ربح، ارتفاع أسعار مورد، المدفوعات، أو التوقع البسيط للشهر القادم.",
      facts: [],
    },
  };
}

function normalize(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[؟?]/g, "")
    .toLowerCase();
}

function scoreOf(text: string, keywords: string[]) {
  return keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 2 : 0), 0);
}

function money(value: number) {
  return value.toFixed(2);
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}
