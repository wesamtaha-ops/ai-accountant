export type ExtractedInvoiceLine = {
  productName: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
  lineTotalStated?: number;
};

export type ExtractedInvoice = {
  invoiceNumber: string;
  date: string;
  type: "SALE" | "PURCHASE";
  partyName: string;
  paymentStatus: "UNPAID" | "PAID" | "PARTIAL";
  paymentMethod: "CASH" | "CARD" | "TRANSFER" | "OTHER" | null;
  notes: string;
  discount: number;
  tax: number;
  totalStated?: number;
  lines: ExtractedInvoiceLine[];
};

export type InvoiceReadRequest = {
  fileName?: string;
  mimeType?: string;
  buffer?: Buffer;
  scenario?: string;
};

export type InvoiceReadOutput = {
  extracted: ExtractedInvoice;
  previewImage?: Buffer;
  previewExt?: string;
  provider?: string;
};

export interface InvoiceReader {
  readonly provider: string;
  read(input: InvoiceReadRequest): Promise<InvoiceReadOutput>;
}

export function resolveReaderScenario(input: InvoiceReadRequest): "demo" | "clean" | "duplicate" {
  const hint = `${input.scenario ?? ""} ${input.fileName ?? ""}`.toLowerCase();
  if (hint.includes("clean") || hint.includes("سليم")) {
    return "clean";
  }
  if (hint.includes("dup") || hint.includes("مكرر")) {
    return "duplicate";
  }
  return "demo";
}
