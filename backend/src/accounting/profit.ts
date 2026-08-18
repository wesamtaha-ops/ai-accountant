import { roundMoney } from "./money.js";

export type ProfitInput = {
  sales: number;
  cogs: number;
  expenses: number;
};

export type ProfitResult = {
  sales: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  marginPercent: number;
};

export function computeProfit(input: ProfitInput): ProfitResult {
  const sales = roundMoney(input.sales);
  const cogs = roundMoney(input.cogs);
  const expenses = roundMoney(input.expenses);
  const grossProfit = roundMoney(sales - cogs);
  const netProfit = roundMoney(grossProfit - expenses);
  const marginPercent = sales > 0 ? roundMoney((netProfit / sales) * 100) : 0;

  return { sales, cogs, grossProfit, expenses, netProfit, marginPercent };
}
