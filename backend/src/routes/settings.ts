import type { Setting } from "@prisma/client";
import { Router } from "express";
import { asyncHandler, HttpError } from "../lib/http.js";
import { parseSettingsPayload } from "../lib/productPayload.js";
import { prisma } from "../lib/prisma.js";
import { toNumber } from "../lib/serialize.js";

export const settingsRouter = Router();

settingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await readSettings());
  }),
);

settingsRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const payload = parseSettingsPayload(req.body);
    const current = await prisma.setting.findFirst();

    if (!current) {
      throw new HttpError(404, "لم يتم العثور على الإعدادات");
    }

    const settings = await prisma.setting.update({
      where: { id: current.id },
      data: payload,
    });

    res.json(serializeSettings(settings));
  }),
);

async function readSettings() {
  const settings = await prisma.setting.findFirst();
  if (!settings) {
    throw new HttpError(404, "لم يتم العثور على الإعدادات");
  }

  return serializeSettings(settings);
}

function serializeSettings(settings: Setting) {
  return {
    companyName: settings.companyName,
    currency: settings.currency,
    priceTolerancePercent: toNumber(settings.priceTolerancePercent),
    defaultTaxPercent: toNumber(settings.defaultTaxPercent),
    openingCashBalance: toNumber(settings.openingCashBalance),
  };
}
