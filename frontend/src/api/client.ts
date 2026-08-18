const API_BASE = "/api";

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json().catch(() => ({}))) as { message?: string };

  if (!response.ok) {
    throw new ApiError(data.message ?? "تعذر تنفيذ العملية");
  }

  return data as T;
}

export type StatsResponse = {
  companyName: string;
  currency: string;
  priceTolerancePercent: number;
  counts: {
    products: number;
    customers: number;
    suppliers: number;
    invoices: number;
    invoiceLines: number;
    stockMovements: number;
    cashMovements: number;
    expenses: number;
    audits: number;
    insights: number;
  };
  invoiceStatuses: {
    draft: number;
    needsReview: number;
    approved: number;
    rejected: number;
  };
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  expectedPurchasePrice: number;
  expectedSalePrice: number;
  stockQuantity: number;
  minStockLevel: number;
  expectedMarginPercent: number;
  isLowStock: boolean;
};

export type ProductInput = {
  sku: string;
  name: string;
  category: string;
  unit: string;
  expectedPurchasePrice: number;
  expectedSalePrice: number;
  stockQuantity: number;
  minStockLevel: number;
};

export type Settings = {
  companyName: string;
  currency: string;
  priceTolerancePercent: number;
  defaultTaxPercent: number;
  openingCashBalance: number;
};

export type PriceCheckResult = {
  expectedPrice: number;
  invoicePrice: number;
  difference: number;
  percentChange: number;
  tolerancePercent: number;
  exceedsTolerance: boolean;
  direction: "higher" | "lower" | "equal";
  message: string;
};

export type InvoiceType = "SALE" | "PURCHASE";
export type InvoiceStatus = "DRAFT" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED";
export type PaymentStatus = "UNPAID" | "PAID" | "PARTIAL";
export type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "OTHER";

export type InvoiceSummary = {
  id: string;
  invoiceNumber: string;
  type: InvoiceType;
  date: string;
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  partyName: string;
  customerId: string | null;
  supplierId: string | null;
  totalStated: number;
  totalComputed: number;
  safetyScore: number | null;
  issuesCount: number;
  linesCount: number;
  editable: boolean;
};

export type InvoiceLine = {
  id?: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotalStated: number;
  lineTotalComputed: number;
};

export type AuditResult = {
  id: string;
  type: "CALCULATION_ERROR" | "PRICE_DEVIATION" | "DUPLICATE" | "OTHER";
  severity: "ERROR" | "WARNING" | "INFO";
  field: string | null;
  lineId: string | null;
  invoiceValue: number | null;
  expectedValue: number | null;
  message: string;
};

export type AiReview = {
  summary: string;
  recommendation: string;
};

export type InvoiceDetail = InvoiceSummary & {
  notes: string | null;
  source: "MANUAL" | "OCR";
  originalFileUrl: string | null;
  discountStated: number;
  taxStated: number;
  subtotalStated: number;
  discountComputed: number;
  taxComputed: number;
  subtotalComputed: number;
  lines: InvoiceLine[];
  auditResults: AuditResult[];
  aiReview: AiReview | null;
};

export type InvoiceInput = {
  invoiceNumber: string;
  type: InvoiceType;
  date: string;
  customerId?: string | null;
  supplierId?: string | null;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod | null;
  notes?: string | null;
  discount: number;
  tax: number;
  statedTotal?: number;
  source?: "MANUAL" | "OCR";
  originalFileUrl?: string | null;
  lines: Array<{
    productId?: string | null;
    productName: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    tax: number;
    lineTotalStated?: number;
  }>;
};

export type Party = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

export type PartyInput = {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
};

export const api = {
  health: () => request<{ ok: boolean }>("/health"),
  stats: () => request<StatsResponse>("/meta/stats"),
  products: () => request<Product[]>("/products"),
  createProduct: (payload: ProductInput) =>
    request<Product>("/products", { method: "POST", body: JSON.stringify(payload) }),
  updateProduct: (id: string, payload: ProductInput) =>
    request<Product>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteProduct: (id: string) => request<void>(`/products/${id}`, { method: "DELETE" }),
  checkProductPrice: (id: string, invoicePrice: number) =>
    request<PriceCheckResult>(`/products/${id}/price-check`, {
      method: "POST",
      body: JSON.stringify({ invoicePrice, kind: "purchase" }),
    }),
  invoices: (params?: { type?: InvoiceType; status?: InvoiceStatus; q?: string }) => {
    const search = new URLSearchParams();
    if (params?.type) search.set("type", params.type);
    if (params?.status) search.set("status", params.status);
    if (params?.q) search.set("q", params.q);
    const query = search.toString();
    return request<InvoiceSummary[]>(`/invoices${query ? `?${query}` : ""}`);
  },
  invoice: (id: string) => request<InvoiceDetail>(`/invoices/${id}`),
  nextInvoiceNumber: (type: InvoiceType) =>
    request<{ invoiceNumber: string }>(`/invoices/next-number?type=${type}`),
  readInvoice: (payload: InvoiceReadInput) =>
    request<InvoiceReadResult>("/invoices/read", { method: "POST", body: JSON.stringify(payload) }),
  previewInvoice: (payload: InvoiceReadDraft) =>
    request<InvoiceReadResult>("/invoices/preview", { method: "POST", body: JSON.stringify(payload) }),
  createInvoice: (payload: InvoiceInput) =>
    request<InvoiceDetail>("/invoices", { method: "POST", body: JSON.stringify(payload) }),
  updateInvoice: (id: string, payload: InvoiceInput) =>
    request<InvoiceDetail>(`/invoices/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteInvoice: (id: string) => request<void>(`/invoices/${id}`, { method: "DELETE" }),
  auditInvoice: (id: string) => request<InvoiceDetail>(`/invoices/${id}/audit`, { method: "POST" }),
  customers: () => request<Party[]>("/customers"),
  createCustomer: (payload: PartyInput) =>
    request<Party>("/customers", { method: "POST", body: JSON.stringify(payload) }),
  updateCustomer: (id: string, payload: PartyInput) =>
    request<Party>(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteCustomer: (id: string) => request<void>(`/customers/${id}`, { method: "DELETE" }),
  suppliers: () => request<Party[]>("/suppliers"),
  createSupplier: (payload: PartyInput) =>
    request<Party>("/suppliers", { method: "POST", body: JSON.stringify(payload) }),
  updateSupplier: (id: string, payload: PartyInput) =>
    request<Party>(`/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteSupplier: (id: string) => request<void>(`/suppliers/${id}`, { method: "DELETE" }),
  approveInvoice: (id: string) => request<InvoiceDetail>(`/invoices/${id}/approve`, { method: "POST" }),
  rejectInvoice: (id: string) => request<InvoiceDetail>(`/invoices/${id}/reject`, { method: "POST" }),
  stockMovements: (productId?: string) =>
    request<StockMovement[]>(`/stock-movements${productId ? `?productId=${productId}` : ""}`),
  cashLedger: () => request<CashLedger>("/cash-movements"),
  createCashMovement: (payload: CashMovementInput) =>
    request<CashMovement>("/cash-movements", { method: "POST", body: JSON.stringify(payload) }),
  settings: () => request<Settings>("/settings"),
  updateSettings: (payload: Settings) =>
    request<Settings>("/settings", { method: "PATCH", body: JSON.stringify(payload) }),
  dashboard: (params?: ReportQuery) => request<DashboardReport>(`/reports/dashboard${toQuery(params)}`),
  profitReport: (params?: ReportQuery) => request<ProfitReport>(`/reports/profit${toQuery(params)}`),
  salesReport: (params?: ReportQuery) => request<SalesReportRow[]>(`/reports/sales${toQuery(params)}`),
  purchasesReport: (params?: ReportQuery) => request<PurchasesReportRow[]>(`/reports/purchases${toQuery(params)}`),
  analytics: () => request<AnalyticsResponse>("/analytics"),
  refreshAnalytics: () => request<AnalyticsResponse>("/analytics/refresh", { method: "POST" }),
  askAssistant: (question: string) =>
    request<AssistantReply>("/analytics/ask", { method: "POST", body: JSON.stringify({ question }) }),
  forecast: () => request<ForecastResponse>("/forecast"),
};

export type PeriodPreset = "today" | "week" | "month" | "custom";

export type ReportQuery = {
  period?: PeriodPreset;
  from?: string;
  to?: string;
  customerId?: string;
  supplierId?: string;
  productId?: string;
};

export type ProfitReport = {
  purchases: number;
  sales: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  marginPercent: number;
};

export type MonthlyPoint = {
  month: string;
  label: string;
  sales: number;
  purchases: number;
  expenses: number;
  profit: number;
  receipts: number;
  payments: number;
};

export type DashboardReport = {
  currency: string;
  companyName: string;
  period: {
    preset: PeriodPreset;
    from: string;
    to: string;
  };
  cards: {
    sales: number;
    purchases: number;
    expenses: number;
    netProfit: number;
    marginPercent: number;
    cashBalance: number;
    inventoryValue: number;
    invoicesCount: number;
    problemInvoices: number;
  };
  monthly: MonthlyPoint[];
  topProducts: Array<{ name: string; quantity: number; sales: number }>;
  lowStock: Array<{
    id: string;
    name: string;
    stockQuantity: number;
    minStockLevel: number;
  }>;
};

export type SalesReportRow = {
  productId: string;
  productName: string;
  quantity: number;
  sales: number;
  profit: number;
};

export type PurchasesReportRow = {
  invoiceNumber: string;
  date: string;
  supplierName: string;
  productName: string;
  quantity: number;
  cost: number;
};

function toQuery(params?: ReportQuery): string {
  if (!params) {
    return "";
  }

  const search = new URLSearchParams();
  if (params.period) search.set("period", params.period);
  if (params.period === "custom") {
    if (params.from) search.set("from", params.from);
    if (params.to) search.set("to", params.to);
  }
  if (params.customerId) search.set("customerId", params.customerId);
  if (params.supplierId) search.set("supplierId", params.supplierId);
  if (params.productId) search.set("productId", params.productId);
  const query = search.toString();
  return query ? `?${query}` : "";
}

export type StockMovement = {
  id: string;
  date: string;
  productId: string;
  productName: string;
  type: "IN" | "OUT";
  invoiceId: string | null;
  invoiceNumber: string | null;
  quantityIn: number;
  quantityOut: number;
  balanceAfter: number;
  notes: string | null;
};

export type CashMovement = {
  id: string;
  date: string;
  type: "RECEIPT" | "PAYMENT";
  amount: number;
  invoiceId: string | null;
  invoiceNumber: string | null;
  description: string;
  paymentMethod: PaymentMethod;
};

export type CashLedger = {
  openingBalance: number;
  receipts: number;
  payments: number;
  currentBalance: number;
  movements: CashMovement[];
};

export type FieldTone = "ok" | "warn" | "error";

export type InvoiceReadDraft = InvoiceInput & {
  partyName?: string;
};

export type InvoiceReadInput = {
  fileName?: string;
  mimeType?: string;
  contentBase64?: string;
  scenario?: "demo" | "clean" | "duplicate";
};

export type InvoiceReadResult = {
  provider: string;
  previewUrl: string;
  draft: InvoiceReadDraft;
  computed: {
    subtotal: number;
    total: number;
    lines: Array<{ productName: string; lineTotalComputed: number; lineTotalStated: number }>;
  };
  auditResults: AuditResult[];
  aiReview: AiReview;
  safetyScore: number;
  fieldTones: {
    invoiceNumber: FieldTone;
    date: FieldTone;
    party: FieldTone;
    total: FieldTone;
    lines: Array<{ product: FieldTone; unitPrice: FieldTone; lineTotal: FieldTone }>;
  };
  currency: string;
};

export type InsightImportance = "LOW" | "MEDIUM" | "HIGH";

export type AnalyticsInsight = {
  id: string;
  observation: string;
  importance: InsightImportance;
  explanation: string;
  suggestedAction: string;
};

export type AnalyticsResponse = {
  currency: string;
  insights: AnalyticsInsight[];
  suggestedQuestions: string[];
};

export type ForecastConfidence = "LOW" | "MEDIUM" | "HIGH";

export type ForecastResponse = {
  method: "linear";
  baselineMethod: "moving-average";
  confidence: ForecastConfidence;
  slope: number;
  movingAverage: number;
  historyMonths: number;
  history: Array<{ key: string; label: string; profit: number; sales: number; expenses: number }>;
  months: Array<{ key: string; label: string; profit: number; sales: number; expenses: number }>;
  chart: Array<{ label: string; actual: number | null; forecast: number | null }>;
  explanation: string;
};

export type AssistantReply = {
  intent: string;
  answer: string;
  facts: Array<{ label: string; value: string }>;
  source: "database";
};

export type CashMovementInput = {
  type: "RECEIPT" | "PAYMENT";
  amount: number;
  description: string;
  date: string;
  paymentMethod: PaymentMethod;
};
