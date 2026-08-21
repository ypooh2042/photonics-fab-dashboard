import { getDb } from "./db.js";
import { resolvePhoto } from "./photo-store.js";
import type { NoteExtraction, ExtractedChipRun, ExtractedStage } from "./types.js";

interface ChipRunRow {
  id: number;
  project_id: number;
  label: string;
  aliases: string;
}

function findProjectId(slug: string | null): number | null {
  if (!slug) return null;
  const db = getDb();
  const row = db.prepare("SELECT id FROM projects WHERE slug = ?").get(slug) as
    | { id: number }
    | undefined;
  return row?.id ?? null;
}

function findMatchingChipRun(projectId: number | null, matchHint: string): ChipRunRow | null {
  const db = getDb();
  const candidates = (
    projectId
      ? db.prepare("SELECT id, project_id, label, aliases FROM chip_runs WHERE project_id = ?").all(projectId)
      : db.prepare("SELECT id, project_id, label, aliases FROM chip_runs").all()
  ) as ChipRunRow[];

  const hint = matchHint.trim().toLowerCase();
  for (const c of candidates) {
    if (c.label.trim().toLowerCase() === hint) return c;
    const aliases = JSON.parse(c.aliases) as string[];
    if (aliases.some((a) => a.trim().toLowerCase() === hint)) return c;
  }
  return null;
}

function resolveOrCreateChipRun(
  extracted: ExtractedChipRun,
  noteDate: string,
  notePath: string,
): number | null {
  const db = getDb();
  const projectId = findProjectId(extracted.project_slug);
  const existing = findMatchingChipRun(projectId, extracted.match_hint);

  if (existing) {
    const aliases = JSON.parse(existing.aliases) as string[];
    if (
      extracted.label.trim().toLowerCase() !== existing.label.trim().toLowerCase() &&
      !aliases.includes(extracted.label)
    ) {
      aliases.push(extracted.label);
    }
    const sourcePaths = db
      .prepare("SELECT source_note_paths FROM chip_runs WHERE id = ?")
      .get(existing.id) as { source_note_paths: string };
    const paths = new Set(JSON.parse(sourcePaths.source_note_paths) as string[]);
    paths.add(notePath);

    db.prepare(
      `UPDATE chip_runs SET aliases = ?, last_updated_date = ?, source_note_paths = ?, updated_at = datetime('now')
       WHERE id = ?`,
    ).run(JSON.stringify(aliases), noteDate, JSON.stringify([...paths]), existing.id);
    return existing.id;
  }

  if (!projectId) {
    console.warn(
      `[upsert] skipping new chip_run "${extracted.label}" — no resolvable project_slug (needs manual admin review)`,
    );
    return null;
  }

  const result = db
    .prepare(
      `INSERT INTO chip_runs (project_id, label, aliases, first_seen_date, last_updated_date, source_note_paths, llm_confidence, needs_review)
       VALUES (?, ?, '[]', ?, ?, ?, ?, ?)`,
    )
    .run(
      projectId,
      extracted.label,
      noteDate,
      noteDate,
      JSON.stringify([notePath]),
      extracted.confidence,
      extracted.confidence < 0.6 ? 1 : 0,
    );
  return Number(result.lastInsertRowid);
}

/**
 * Recomputes each stage's per-type occurrence number (seq) from its current
 * display position (sort_order). Mirrors apps/web/lib/admin-data.ts's
 * renumberSeq (that copy runs after admin edits like delete/reorder/move;
 * this one runs after ingestion writes) — kept as a separate copy since this
 * package can't import Next.js app code.
 */
function renumberSeq(chipRunId: number): void {
  const db = getDb();
  const stages = db
    .prepare("SELECT id, stage_type FROM pipeline_stage_instances WHERE chip_run_id = ? ORDER BY sort_order ASC, id ASC")
    .all(chipRunId) as { id: number; stage_type: string }[];

  const counters: Record<string, number> = {};
  const update = db.prepare("UPDATE pipeline_stage_instances SET seq = ? WHERE id = ?");
  for (const s of stages) {
    counters[s.stage_type] = (counters[s.stage_type] ?? 0) + 1;
    update.run(counters[s.stage_type], s.id);
  }
}

function upsertStages(chipRunId: number, stages: ExtractedStage[], noteDate: string, notePath: string) {
  const db = getDb();

  for (const stage of stages) {
    // A completed "delivery" stage, or a "completed_other" stage (run closed out
    // for a reason other than physical delivery — e.g. discontinued/repurposed
    // after its goal was otherwise achieved), marks the whole chip run as done.
    if (
      (stage.stage_type === "delivery" || stage.stage_type === "completed_other") &&
      stage.status === "complete"
    ) {
      db.prepare("UPDATE chip_runs SET status = 'complete', updated_at = datetime('now') WHERE id = ?").run(
        chipRunId,
      );
    }
    // 1) Same note reprocessed — update the instance we already recorded from this note.
    const reprocessed = db
      .prepare(
        `SELECT id, source_note_paths FROM pipeline_stage_instances
         WHERE chip_run_id = ? AND stage_type = ? AND source_note_paths LIKE ?
         ORDER BY seq DESC LIMIT 1`,
      )
      .get(chipRunId, stage.stage_type, `%${notePath}%`) as
      | { id: number; source_note_paths: string }
      | undefined;

    // 2) Otherwise continue the most recent still-open instance of this stage type.
    const openInstance = !reprocessed
      ? (db
          .prepare(
            `SELECT id, source_note_paths FROM pipeline_stage_instances
             WHERE chip_run_id = ? AND stage_type = ? AND status != 'complete'
             ORDER BY seq DESC LIMIT 1`,
          )
          .get(chipRunId, stage.stage_type) as { id: number; source_note_paths: string } | undefined)
      : undefined;

    const target = reprocessed ?? openInstance;

    if (target) {
      const paths = new Set(JSON.parse(target.source_note_paths) as string[]);
      paths.add(notePath);
      db.prepare(
        `UPDATE pipeline_stage_instances SET
           status = ?, blocked_reason = ?, label = ?,
           completed_date = CASE WHEN ? = 'complete' THEN ? ELSE completed_date END,
           started_date = COALESCE(started_date, ?),
           source_note_paths = ?, updated_at = datetime('now')
         WHERE id = ?`,
      ).run(
        stage.status,
        stage.blocked_reason,
        stage.note,
        stage.status,
        noteDate,
        noteDate,
        JSON.stringify([...paths]),
        target.id,
      );
      attachPhotos(chipRunId, target.id, stage.photos, notePath);
      continue;
    }

    // 3) Genuinely new occurrence of this stage (e.g. a repeated lithography pass).
    const maxSeq = db
      .prepare(
        "SELECT COALESCE(MAX(seq), 0) AS m FROM pipeline_stage_instances WHERE chip_run_id = ? AND stage_type = ?",
      )
      .get(chipRunId, stage.stage_type) as { m: number };
    const maxSortOrder = db
      .prepare("SELECT COALESCE(MAX(sort_order), 0) AS m FROM pipeline_stage_instances WHERE chip_run_id = ?")
      .get(chipRunId) as { m: number };

    const result = db
      .prepare(
        `INSERT INTO pipeline_stage_instances
           (chip_run_id, seq, sort_order, stage_type, label, status, blocked_reason, started_date, completed_date, source_note_paths)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        chipRunId,
        maxSeq.m + 1,
        maxSortOrder.m + 1,
        stage.stage_type,
        stage.note,
        stage.status,
        stage.blocked_reason,
        noteDate,
        stage.status === "complete" ? noteDate : null,
        JSON.stringify([notePath]),
      );
    attachPhotos(chipRunId, Number(result.lastInsertRowid), stage.photos, notePath);
  }

  renumberSeq(chipRunId);
}

function attachPhotos(
  chipRunId: number,
  stageInstanceId: number,
  photos: ExtractedStage["photos"],
  notePath: string,
) {
  if (photos.length === 0) return;
  const db = getDb();
  const exists = db.prepare(
    `SELECT 1 FROM chip_run_photos WHERE chip_run_id = ? AND stage_instance_id = ? AND photo_id = ?`,
  );
  const insert = db.prepare(
    `INSERT INTO chip_run_photos (chip_run_id, stage_instance_id, photo_id, caption, source_note_path)
     VALUES (?, ?, ?, ?, ?)`,
  );

  for (const photo of photos) {
    const photoId = resolvePhoto(photo.filename);
    if (photoId === undefined) {
      console.warn(`[upsert] photo "${photo.filename}" not found in vault figures folder — skipping`);
      continue;
    }
    if (exists.get(chipRunId, stageInstanceId, photoId)) continue;
    insert.run(chipRunId, stageInstanceId, photoId, photo.caption, notePath);
  }
}

function upsertRecipeEntries(extraction: NoteExtraction, notePath: string) {
  const db = getDb();
  const findCategory = db.prepare("SELECT id FROM recipe_categories WHERE slug = ?");
  const exists = db.prepare(
    `SELECT 1 FROM recipe_entries WHERE category_id = ? AND recipe_name = ? AND entry_date = ? AND source_excerpt = ?`,
  );
  const insert = db.prepare(
    `INSERT INTO recipe_entries
       (category_id, recipe_name, entry_date, params, source_note_path, source_excerpt, llm_confidence, needs_review)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const entry of extraction.recipe_entries) {
    const cat = findCategory.get(entry.category) as { id: number } | undefined;
    if (!cat) {
      console.warn(`[upsert] unknown recipe category "${entry.category}" — skipping entry`);
      continue;
    }
    if (exists.get(cat.id, entry.recipe_name, entry.entry_date, entry.source_excerpt)) continue;
    insert.run(
      cat.id,
      entry.recipe_name,
      entry.entry_date,
      JSON.stringify(entry.params),
      notePath,
      entry.source_excerpt,
      null,
      0,
    );
  }
}

/** Infers the note's own date from its filename (YYYY-MM-DD prefix, handling ~/to date-range variants). */
export function inferNoteDate(filename: string): string {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : new Date().toISOString().slice(0, 10);
}

export function upsertNoteExtraction(
  extraction: NoteExtraction,
  notePath: string,
  noteDate: string,
): void {
  const db = getDb();
  const tx = db.transaction(() => {
    for (const chipRun of extraction.chip_runs) {
      const chipRunId = resolveOrCreateChipRun(chipRun, noteDate, notePath);
      if (chipRunId) upsertStages(chipRunId, chipRun.stages, noteDate, notePath);
    }
    upsertRecipeEntries(extraction, notePath);
  });
  tx();
}
