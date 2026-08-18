import { roundMoney } from "./money.js";

export type ForecastConfidence = "LOW" | "MEDIUM" | "HIGH";

export function movingAverageForecast(history: number[], window = 3) {
  const sample = history.slice(-window);
  if (sample.length === 0) {
    return { estimate: 0, confidence: "LOW" as const, sample };
  }

  const estimate = roundMoney(sample.reduce((sum, value) => sum + value, 0) / sample.length);
  return {
    estimate,
    confidence: confidenceFromHistory(sample),
    sample: sample.map(roundMoney),
  };
}

export function linearRegressionForecast(history: number[], steps = 3) {
  if (history.length === 0) {
    return {
      estimates: Array.from({ length: steps }, () => 0),
      slope: 0,
      intercept: 0,
      confidence: "LOW" as const,
    };
  }

  const n = history.length;
  const xs = history.map((_, index) => index);
  const sumX = xs.reduce((sum, value) => sum + value, 0);
  const sumY = history.reduce((sum, value) => sum + value, 0);
  const sumXX = xs.reduce((sum, value) => sum + value * value, 0);
  const sumXY = history.reduce((sum, value, index) => sum + index * value, 0);
  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  const estimates = Array.from({ length: steps }, (_, index) => roundMoney(intercept + slope * (n + index)));

  return {
    estimates,
    slope: roundMoney(slope),
    intercept: roundMoney(intercept),
    confidence: confidenceFromHistory(history),
  };
}

export function confidenceFromHistory(history: number[]): ForecastConfidence {
  if (history.length < 3) {
    return "LOW";
  }

  const mean = history.reduce((sum, value) => sum + value, 0) / history.length;
  const variance = history.reduce((sum, value) => sum + (value - mean) ** 2, 0) / history.length;
  const coefficient = mean === 0 ? 1 : Math.abs(Math.sqrt(variance) / mean);

  if (history.length >= 5 && coefficient < 0.15) {
    return "HIGH";
  }
  if (coefficient < 0.4) {
    return "MEDIUM";
  }
  return "LOW";
}
