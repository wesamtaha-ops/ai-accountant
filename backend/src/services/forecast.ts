import { generateGeminiText, isGeminiConfigured } from "../ai/geminiClient.js";
import { linearRegressionForecast, movingAverageForecast, type ForecastConfidence } from "../accounting/forecast.js";
import { calendarMonthRange } from "../lib/dateRange.js";
import { getTrendSeries } from "./reports.js";

type ForecastPayload = {
  method: "linear";
  baselineMethod: "moving-average";
  confidence: ForecastConfidence;
  slope: number;
  movingAverage: number;
  historyMonths: number;
  history: Array<{ key: string; label: string; profit: number; sales: number; expenses: number }>;
  months: Array<{ key: string; label: string; profit: number; sales: number; expenses: number }>;
  chart: Array<{ label: string; actual: number | null; forecast: number | null }>;
};

export async function getProfitForecast() {
  const monthly = await getTrendSeries();
  const currentKey = calendarMonthRange(0).key;
  const history = monthly.filter((item) => item.month !== currentKey);
  const upcoming = [1, 2, 3].map((offset) => calendarMonthRange(offset));

  const profits = history.map((item) => item.profit);
  const sales = history.map((item) => item.sales);
  const expenses = history.map((item) => item.expenses);

  const profitLine = linearRegressionForecast(profits, 3);
  const salesLine = linearRegressionForecast(sales, 3);
  const expenseLine = linearRegressionForecast(expenses, 3);
  const average = movingAverageForecast(profits);

  const months = upcoming.map((month, index) => ({
    key: month.key,
    label: month.label,
    profit: profitLine.estimates[index] ?? 0,
    sales: salesLine.estimates[index] ?? 0,
    expenses: expenseLine.estimates[index] ?? 0,
  }));

  const computed: ForecastPayload = {
    method: "linear",
    baselineMethod: "moving-average",
    confidence: profitLine.confidence,
    slope: profitLine.slope,
    movingAverage: average.estimate,
    historyMonths: history.length,
    history: history.map((item) => ({
      key: item.month,
      label: item.label,
      profit: item.profit,
      sales: item.sales,
      expenses: item.expenses,
    })),
    months,
    chart: [
      ...history.map((item, index, rows) => ({
        label: item.label,
        actual: item.profit,
        forecast: index === rows.length - 1 ? item.profit : (null as number | null),
      })),
      ...months.map((item) => ({
        label: item.label,
        actual: null as number | null,
        forecast: item.profit,
      })),
    ],
  };

  return {
    ...computed,
    explanation: await explainForecast(computed),
  };
}

async function explainForecast(computed: ForecastPayload) {
  const fallback = `التوقع محسوب بانحدار خطي بسيط من ${computed.historyMonths} أشهر مكتملة. متوسط متحرك مرجعي: ${computed.movingAverage.toFixed(2)}. مستوى الثقة: ${computed.confidence}.`;
  if (!isGeminiConfigured()) {
    return fallback;
  }

  try {
    const text = await generateGeminiText(
      `اشرح توقع الأرباح بالعربية في فقرتين قصيرتين للمحاسب.
استخدم هذه الأرقام فقط ولا تخترع قيماً جديدة:
${JSON.stringify({
        confidence: computed.confidence,
        slope: computed.slope,
        movingAverage: computed.movingAverage,
        history: computed.history,
        months: computed.months,
      })}`,
    );
    return text || fallback;
  } catch {
    return fallback;
  }
}
