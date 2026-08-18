import { HttpError } from "./http.js";

export function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, `${label} مطلوب`);
  }

  return value.trim();
}

export function optionalText(value: unknown): string | null {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "قيمة النص غير صالحة");
  }

  return value.trim();
}

export function requiredNumber(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new HttpError(400, `${label} يجب أن يكون رقماً صفر أو أكبر`);
  }

  return parsed;
}

export function routeId(value: string | string[] | undefined): string {
  const id = Array.isArray(value) ? value[0] : value;
  if (!id) {
    throw new HttpError(400, "المعرف مطلوب");
  }
  return id;
}

export function asObject(body: unknown, message: string): Record<string, unknown> {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, message);
  }

  return body as Record<string, unknown>;
}
