import { Router } from "express";
import { askAssistant, getAnalytics, refreshAnalytics } from "../services/analytics.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { asObject, requiredText } from "../lib/validation.js";

export const analyticsRouter = Router();

analyticsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await getAnalytics());
  }),
);

analyticsRouter.post(
  "/refresh",
  asyncHandler(async (_req, res) => {
    res.json(await refreshAnalytics());
  }),
);

analyticsRouter.post(
  "/ask",
  asyncHandler(async (req, res) => {
    const data = asObject(req.body, "السؤال غير صالح");
    const question = requiredText(data.question, "السؤال");
    if (question.length > 300) {
      throw new HttpError(400, "السؤال أطول من المسموح");
    }
    res.json(await askAssistant(question));
  }),
);
