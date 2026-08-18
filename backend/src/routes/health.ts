import { Router } from "express";
import { isGeminiConfigured } from "../ai/geminiClient.js";
import { prisma } from "../lib/prisma.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({
    ok: true,
    service: "jaafar-backend",
    phase: 10,
    ai: {
      provider: "gemini",
      configured: isGeminiConfigured(),
    },
  });
});
