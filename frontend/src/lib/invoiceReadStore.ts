import type { InvoiceReadResult } from "../api/client";

const key = "jaafar-invoice-read";

export function storeReadResult(result: InvoiceReadResult) {
  sessionStorage.setItem(key, JSON.stringify(result));
}

export function loadReadResult(): InvoiceReadResult | null {
  const raw = sessionStorage.getItem(key);
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as InvoiceReadResult;
}
