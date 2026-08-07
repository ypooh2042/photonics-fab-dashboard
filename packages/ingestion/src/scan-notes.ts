import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDb } from "./db.js";

export interface NoteFile {
  /** Path relative to the vault root, e.g. "2026/2026-07-14 KANC e-beam exposure (EMC airy 1차).md" */
  relPath: string;
  absPath: string;
  mtime: string;
  contentSha256: string;
}

function vaultPath(): string {
  const p = process.env.VAULT_PATH;
  if (!p) throw new Error("VAULT_PATH env var is not set");
  return p;
}

export function listDailyNotes(): NoteFile[] {
  const dailyDir = path.join(vaultPath(), "2026");
  const files = fs.readdirSync(dailyDir).filter((f) => f.endsWith(".md"));
  return files.map((f) => {
    const absPath = path.join(dailyDir, f);
    const stat = fs.statSync(absPath);
    const content = fs.readFileSync(absPath);
    return {
      relPath: path.join("2026", f),
      absPath,
      mtime: stat.mtime.toISOString(),
      contentSha256: crypto.createHash("sha256").update(content).digest("hex"),
    };
  });
}

/** Notes whose mtime+hash differ from what's recorded in note_ingestion_state (or are new). */
export function findChangedNotes(notes: NoteFile[]): NoteFile[] {
  const db = getDb();
  const stmt = db.prepare(
    "SELECT mtime, content_sha256 FROM note_ingestion_state WHERE note_path = ?",
  );
  return notes.filter((note) => {
    const row = stmt.get(note.relPath) as { mtime: string; content_sha256: string } | undefined;
    if (!row) return true;
    return row.mtime !== note.mtime || row.content_sha256 !== note.contentSha256;
  });
}

export function markNoteProcessed(
  note: NoteFile,
  status: "success" | "error",
  opts: { error?: string; model?: string; rawResponse?: string } = {},
): void {
  const db = getDb();
  // On error, deliberately store sentinel mtime/hash values that can never match a
  // real file — this keeps the note showing up as "changed" in findChangedNotes so
  // the next cron cycle retries it, instead of silently treating it as processed.
  const mtime = status === "success" ? note.mtime : "__failed__";
  const contentSha256 = status === "success" ? note.contentSha256 : "__failed__";

  db.prepare(
    `INSERT INTO note_ingestion_state
       (note_path, mtime, content_sha256, last_processed_at, last_extraction_status, last_extraction_error, consecutive_failures, extraction_model, raw_llm_response)
     VALUES (@note_path, @mtime, @content_sha256, datetime('now'), @status, @error, @failures, @model, @raw)
     ON CONFLICT(note_path) DO UPDATE SET
       mtime = excluded.mtime,
       content_sha256 = excluded.content_sha256,
       last_processed_at = excluded.last_processed_at,
       last_extraction_status = excluded.last_extraction_status,
       last_extraction_error = excluded.last_extraction_error,
       consecutive_failures = CASE WHEN excluded.last_extraction_status = 'success' THEN 0 ELSE note_ingestion_state.consecutive_failures + 1 END,
       extraction_model = excluded.extraction_model,
       raw_llm_response = excluded.raw_llm_response`,
  ).run({
    note_path: note.relPath,
    mtime,
    content_sha256: contentSha256,
    status,
    error: opts.error ?? null,
    failures: status === "error" ? 1 : 0,
    model: opts.model ?? null,
    raw: opts.rawResponse ?? null,
  });
}
