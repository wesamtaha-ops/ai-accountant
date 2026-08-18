import type { InvoiceReader } from "./invoiceReader.js";
import { GeminiInvoiceReader } from "./providers/geminiReader.js";
import { MockInvoiceReader } from "./providers/mockReader.js";

export function createInvoiceReader(): InvoiceReader {
  const provider = process.env.INVOICE_READER_PROVIDER ?? "gemini";
  if (provider === "mock") {
    return new MockInvoiceReader();
  }
  return new GeminiInvoiceReader();
}
