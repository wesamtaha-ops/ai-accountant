import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { CashPage } from "./pages/CashPage";
import { CustomersPage } from "./pages/CustomersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { InvoiceEditorPage } from "./pages/InvoiceEditorPage";
import { InvoiceReviewPage } from "./pages/InvoiceReviewPage";
import { InvoiceUploadPage } from "./pages/InvoiceUploadPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { DemoPage } from "./pages/DemoPage";
import { ForecastPage } from "./pages/ForecastPage";
import { ProductsPage } from "./pages/ProductsPage";
import { ProfitReportPage } from "./pages/reports/ProfitReportPage";
import { PurchasesReportPage } from "./pages/reports/PurchasesReportPage";
import { SalesReportPage } from "./pages/reports/SalesReportPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StockMovementsPage } from "./pages/StockMovementsPage";
import { SuppliersPage } from "./pages/SuppliersPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/new" element={<InvoiceEditorPage />} />
        <Route path="invoices/upload" element={<InvoiceUploadPage />} />
        <Route path="invoices/review" element={<InvoiceReviewPage />} />
        <Route path="invoices/:id" element={<InvoiceEditorPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="stock" element={<StockMovementsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="cash" element={<CashPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/sales" element={<SalesReportPage />} />
        <Route path="reports/purchases" element={<PurchasesReportPage />} />
        <Route path="reports/profit" element={<ProfitReportPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="forecast" element={<ForecastPage />} />
        <Route path="demo" element={<DemoPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
