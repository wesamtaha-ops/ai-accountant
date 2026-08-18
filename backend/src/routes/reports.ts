import { Router } from "express";
import { resolveDateRange } from "../lib/dateRange.js";
import { asyncHandler } from "../lib/http.js";
import { getDashboard, getProfitReport, getPurchasesReport, getSalesReport } from "../services/reports.js";

export const reportsRouter = Router();

reportsRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    res.json(await getDashboard(resolveDateRange(req.query)));
  }),
);

reportsRouter.get(
  "/profit",
  asyncHandler(async (req, res) => {
    res.json(await getProfitReport(resolveDateRange(req.query)));
  }),
);

reportsRouter.get(
  "/sales",
  asyncHandler(async (req, res) => {
    res.json(
      await getSalesReport(resolveDateRange(req.query), optionalId(req.query.customerId), optionalId(req.query.productId)),
    );
  }),
);

reportsRouter.get(
  "/purchases",
  asyncHandler(async (req, res) => {
    res.json(
      await getPurchasesReport(
        resolveDateRange(req.query),
        optionalId(req.query.supplierId),
        optionalId(req.query.productId),
      ),
    );
  }),
);

function optionalId(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
