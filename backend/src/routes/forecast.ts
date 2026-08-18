import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import { getProfitForecast } from "../services/forecast.js";

export const forecastRouter = Router();

forecastRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await getProfitForecast());
  }),
);
