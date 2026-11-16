import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * STUB STORAGE — local disk under ./storage. Replace with S3/R2 (PRD §3);
 * Vercel's filesystem is read-only, so this only works locally.
 */
const ROOT = path.join(/*turbopackIgnore: true*/ process.cwd(), "storage");

export async function saveUpload(orgId: string, id: string, ext: string, data: Buffer): Promise<string> {
  const key = `${orgId}/${id}.${ext}`;
  await mkdir(path.join(/*turbopackIgnore: true*/ ROOT, orgId), { recursive: true });
  await writeFile(path.join(/*turbopackIgnore: true*/ ROOT, key), data);
  return key;
}
