const currencyAliases: Record<string, string> = {
  EUR: "EUR",
  USD: "USD",
  SYP: "SYP",
  SAR: "SAR",
  AED: "AED",
  EGP: "EGP",
  JOD: "JOD",
  TRY: "TRY",
  GBP: "GBP",
  "ل.س": "SYP",
  "ل س": "SYP",
  لس: "SYP",
  ليرة: "SYP",
  "ليرة سورية": "SYP",
};

function normalizeCurrency(value: string): { isoCode?: string; label: string } {
  const label = value.trim() || "EUR";
  const compact = label.replace(/[.\s]/g, "");
  const isoCode =
    currencyAliases[label] ??
    currencyAliases[compact] ??
    currencyAliases[label.toUpperCase()] ??
    (/^[A-Za-z]{3}$/.test(label) ? label.toUpperCase() : undefined);

  return { isoCode, label };
}

export function formatMoney(value: number, currency = "EUR"): string {
  const { isoCode, label } = normalizeCurrency(currency);
  const amount = new Intl.NumberFormat("ar", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  if (!isoCode) {
    return `${amount} ${label}`;
  }

  try {
    return new Intl.NumberFormat("ar", {
      style: "currency",
      currency: isoCode,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${amount} ${label}`;
  }
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function formatRatio(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("ar", {
    maximumFractionDigits: 3,
  }).format(value);
}
