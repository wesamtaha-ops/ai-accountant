import { GoogleGenAI } from "@google/genai";
import { HttpError } from "../lib/http.js";

export function geminiModel() {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_BASE_URL);
}

export function createGeminiClient() {
  if (process.env.GOOGLE_GEMINI_BASE_URL) {
    return new GoogleGenAI({});
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new HttpError(503, "أضف GEMINI_API_KEY في ملف البيئة لاستخدام Gemini.");
  }

  return new GoogleGenAI({ apiKey });
}

export async function generateGeminiText(prompt: string) {
  const response = await createGeminiClient().models.generateContent({
    model: geminiModel(),
    contents: prompt,
  });
  return (response.text ?? "").trim();
}

export async function generateGeminiJson<T>(
  prompt: string,
  image?: { mimeType: string; data: string },
): Promise<T> {
  const contents = image
    ? [
        {
          role: "user" as const,
          parts: [{ text: prompt }, { inlineData: { mimeType: image.mimeType, data: image.data } }],
        },
      ]
    : prompt;

  const response = await createGeminiClient().models.generateContent({
    model: geminiModel(),
    contents,
    config: { responseMimeType: "application/json" },
  });

  const raw = (response.text ?? "").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(raw) as T;
}
