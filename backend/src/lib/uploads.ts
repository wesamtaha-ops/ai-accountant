import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const uploadsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../uploads");

export function getUploadsDir() {
  return uploadsDir;
}

export async function saveUpload(fileName: string, buffer: Buffer): Promise<string> {
  await mkdir(uploadsDir, { recursive: true });
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "invoice.bin";
  const stored = `${Date.now()}-${safe}`;
  await writeFile(path.join(uploadsDir, stored), buffer);
  return `/uploads/${stored}`;
}
