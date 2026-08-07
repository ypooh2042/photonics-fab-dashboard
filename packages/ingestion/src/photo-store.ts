import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, "../../../data/admin-photo-uploads");

function figuresPath(): string {
  const vault = process.env.VAULT_PATH;
  if (!vault) throw new Error("VAULT_PATH env var is not set");
  return path.join(vault, "2026", "figures");
}

interface ExistingPhotoRow {
  id: number;
  source_path: string | null;
  file_mtime: string | null;
  file_size: number | null;
}

/**
 * Resolves a bare filename (Obsidian-style resolution) a note references to a `photos.id`,
 * copying the file from the vault's figures folder into data/admin-photo-uploads the first
 * time it's referenced (or re-copying if the vault file has changed since). Only files a note
 * actually attaches get copied — nothing scans or pre-copies the whole figures folder, so
 * images nothing ever references stay untouched in the vault and never take up app storage.
 * Returns undefined if the filename doesn't exist in the vault's figures folder.
 */
export function resolvePhoto(rawFilename: string): number | undefined {
  const filename = path.basename(rawFilename);
  const absPath = path.join(figuresPath(), filename);
  if (!fs.existsSync(absPath)) return undefined;
  const stat = fs.statSync(absPath);
  if (!stat.isFile()) return undefined;

  const db = getDb();
  const mtime = stat.mtime.toISOString();
  const existing = db
    .prepare("SELECT id, source_path, file_mtime, file_size FROM photos WHERE filename = ?")
    .get(filename) as ExistingPhotoRow | undefined;

  const unchanged =
    existing &&
    existing.source_path === absPath &&
    existing.file_mtime === mtime &&
    existing.file_size === stat.size;
  if (unchanged) return existing.id;

  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const destPath = path.join(UPLOADS_DIR, filename);
  fs.copyFileSync(absPath, destPath);

  if (existing) {
    db.prepare(
      "UPDATE photos SET resolved_path = ?, source_path = ?, file_mtime = ?, file_size = ? WHERE id = ?",
    ).run(destPath, absPath, mtime, stat.size, existing.id);
    return existing.id;
  }

  const result = db
    .prepare(
      `INSERT INTO photos (filename, resolved_path, source_path, file_mtime, file_size) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(filename, destPath, absPath, mtime, stat.size);
  return Number(result.lastInsertRowid);
}
