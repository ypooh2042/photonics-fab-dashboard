import fs from "node:fs";
import { listDailyNotes, findChangedNotes, markNoteProcessed } from "./scan-notes.js";
import { extractNote } from "./extract.js";
import { upsertNoteExtraction, inferNoteDate } from "./upsert.js";
import { getDb } from "./db.js";
import type { KnownChipRun, KnownProject, KnownRecipe, RecipeCategory } from "./types.js";

const MAX_CONSECUTIVE_FAILURES = 3;

// Live tracking only covers notes from this date forward (the day after the
// June-July backfill's last real note). Anything older is intentionally out of
// scope for the incremental pipeline — re-run backfill.ts manually to sweep in
// any older/retroactively-written notes. Already-tracked notes (from backfill)
// remain eligible for edit-detection regardless of this cutoff.
const TRACKING_START_DATE = "2026-07-22";

function allKnownProjects(): KnownProject[] {
  const db = getDb();
  return db.prepare("SELECT slug, name FROM projects").all() as KnownProject[];
}

function allKnownChipRuns(): KnownChipRun[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT cr.id, p.slug AS project_slug, p.name AS project_name, cr.label, cr.aliases
       FROM chip_runs cr JOIN projects p ON p.id = cr.project_id`,
    )
    .all() as { id: number; project_slug: string; project_name: string; label: string; aliases: string }[];
  return rows.map((r) => ({
    id: r.id,
    projectSlug: r.project_slug,
    projectName: r.project_name,
    label: r.label,
    aliases: JSON.parse(r.aliases),
  }));
}

function allKnownRecipes(): KnownRecipe[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT rc.slug AS category, names.recipe_name AS recipe_name, COALESCE(rd.entry_mode, 'full') AS entry_mode
       FROM (
         SELECT category_id, recipe_name FROM recipe_entries
         UNION
         SELECT category_id, recipe_name FROM recipe_definitions
       ) names
       JOIN recipe_categories rc ON rc.id = names.category_id
       LEFT JOIN recipe_definitions rd ON rd.category_id = names.category_id AND rd.recipe_name = names.recipe_name`,
    )
    .all() as { category: string; recipe_name: string; entry_mode: "full" | "log_only" }[];
  return rows.map((r) => ({ category: r.category as RecipeCategory, recipeName: r.recipe_name, entryMode: r.entry_mode }));
}

function consecutiveFailures(notePath: string): number {
  const db = getDb();
  const row = db
    .prepare("SELECT consecutive_failures FROM note_ingestion_state WHERE note_path = ?")
    .get(notePath) as { consecutive_failures: number } | undefined;
  return row?.consecutive_failures ?? 0;
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`[run-update] ${startedAt} — checking for changes...`);

  const db = getDb();
  const alreadyTracked = new Set(
    (db.prepare("SELECT note_path FROM note_ingestion_state").all() as { note_path: string }[]).map(
      (r) => r.note_path,
    ),
  );

  const notes = listDailyNotes().filter((n) => {
    const filename = n.relPath.split("/").pop()!;
    return inferNoteDate(filename) >= TRACKING_START_DATE || alreadyTracked.has(n.relPath);
  });
  const changed = findChangedNotes(notes);

  if (changed.length === 0) {
    console.log("[run-update] no changed or new notes — nothing to do.");
    return;
  }

  console.log(`[run-update] ${changed.length} changed/new note(s) to process`);

  let ok = 0;
  let failed = 0;
  let skipped = 0;

  for (const note of changed) {
    const filename = note.relPath.split("/").pop()!;
    if (consecutiveFailures(note.relPath) >= MAX_CONSECUTIVE_FAILURES) {
      console.warn(`[run-update] ${filename}: skipping, ${MAX_CONSECUTIVE_FAILURES}+ consecutive failures — needs admin review`);
      skipped++;
      continue;
    }

    try {
      const content = fs.readFileSync(note.absPath, "utf-8");
      const extraction = await extractNote({
        noteContent: content,
        knownProjects: allKnownProjects(),
        knownChipRuns: allKnownChipRuns(),
        knownRecipes: allKnownRecipes(),
      });
      const noteDate = inferNoteDate(filename);
      upsertNoteExtraction(extraction, note.relPath, noteDate);
      markNoteProcessed(note, "success", { model: "claude-sonnet-5 (via claude -p)" });
      console.log(
        `[run-update] ${filename}: ok (${extraction.chip_runs.length} chip_runs, ${extraction.recipe_entries.length} recipe_entries)`,
      );
      ok++;
    } catch (err) {
      console.error(`[run-update] ${filename}: FAILED — ${(err as Error).message}`);
      markNoteProcessed(note, "error", { error: (err as Error).message });
      failed++;
    }
  }

  console.log(`[run-update] done. ok=${ok} failed=${failed} skipped=${skipped}`);
}

main().catch((err) => {
  console.error("[run-update] fatal error:", err);
  process.exit(1);
});
