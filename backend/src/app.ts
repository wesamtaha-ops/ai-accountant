import cors from "cors";
import express from "express";
import { errorHandler } from "./lib/http.js";
import { getUploadsDir } from "./lib/uploads.js";
import { healthRouter } from "./routes/health.js";
import { invoicesRouter } from "./routes/invoices.js";
import { metaRouter } from "./routes/meta.js";
import { customersRouter, suppliersRouter } from "./routes/parties.js";
import { cashRouter, stockRouter } from "./routes/ledger.js";
import { productsRouter } from "./routes/products.js";
import { analyticsRouter } from "./routes/analytics.js";
import { forecastRouter } from "./routes/forecast.js";
import { reportsRouter } from "./routes/reports.js";
import { settingsRouter } from "./routes/settings.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5179",
    }),
  );
  app.use(express.json({ limit: "8mb" }));
  app.use("/uploads", express.static(getUploadsDir()));

  app.use("/api/health", healthRouter);
  app.use("/api/meta", metaRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/invoices", invoicesRouter);
  app.use("/api/customers", customersRouter);
  app.use("/api/suppliers", suppliersRouter);
  app.use("/api/stock-movements", stockRouter);
  app.use("/api/cash-movements", cashRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/forecast", forecastRouter);

  app.use((_req, res) => {
    res.status(404).json({ message: "المسار غير موجود" });
  });
  app.use(errorHandler);

  return app;
}
