export type PeriodPreset = "today" | "week" | "month" | "custom";

export type DateRange = {
  from: Date;
  to: Date;
  preset: PeriodPreset;
};

const monthLabels = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export function resolveDateRange(query: { period?: unknown; from?: unknown; to?: unknown }): DateRange {
  const preset = parsePreset(query.period);
  const now = new Date();
  const today = utcDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  if (preset === "custom") {
    const from = parseDay(query.from) ?? firstOfMonth(today);
    const to = addDays(parseDay(query.to) ?? today, 1);
    return { from, to, preset };
  }

  if (preset === "today") {
    return { from: today, to: addDays(today, 1), preset };
  }

  if (preset === "week") {
    return { from: addDays(today, -6), to: addDays(today, 1), preset };
  }

  return { from: firstOfMonth(today), to: addDays(today, 1), preset: "month" };
}

export function lastMonthsRange(count: number): { from: Date; to: Date } {
  const now = new Date();
  const start = utcDate(now.getUTCFullYear(), now.getUTCMonth() - (count - 1), 1);
  const today = utcDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return { from: start, to: addDays(today, 1) };
}

export function calendarMonthRange(offsetFromCurrent = 0): { from: Date; to: Date; key: string; label: string } {
  const now = new Date();
  const from = utcDate(now.getUTCFullYear(), now.getUTCMonth() + offsetFromCurrent, 1);
  const to = utcDate(now.getUTCFullYear(), now.getUTCMonth() + offsetFromCurrent + 1, 1);
  const key = monthKey(from);
  return { from, to, key, label: monthLabel(key) };
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [, month] = key.split("-");
  return monthLabels[Number(month) - 1] ?? key;
}

export function buildMonthKeys(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const cursor = utcDate(from.getUTCFullYear(), from.getUTCMonth(), 1);
  const end = utcDate(to.getUTCFullYear(), to.getUTCMonth(), 1);

  while (cursor <= end) {
    keys.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return keys;
}

function parsePreset(value: unknown): PeriodPreset {
  if (value === "today" || value === "week" || value === "month" || value === "custom") {
    return value;
  }
  return "month";
}

function parseDay(value: unknown): Date | null {
  if (typeof value !== "string" || value.length < 10) {
    return null;
  }
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function firstOfMonth(date: Date): Date {
  return utcDate(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
