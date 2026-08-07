import fs from "node:fs";
import path from "node:path";
import { getDb } from "./db.js";
import { extractNote } from "./extract.js";
import { upsertNoteExtraction, inferNoteDate } from "./upsert.js";
import { markNoteProcessed } from "./scan-notes.js";
import type { KnownChipRun, KnownProject, KnownRecipe, RecipeCategory } from "./types.js";

async function main() {
  const args = process.argv.slice(2);
  const noteIdx = args.indexOf("--note");
  if (noteIdx === -1 || !args[noteIdx + 1]) {
    console.error(JSON.stringify({ error: "usage: reprocess-one.ts --note <relative path>" }));
    process.exit(1);
  }
  const notePath = args[noteIdx + 1];
  const vaultPath = process.env.VAULT_PATH;
  if (!vaultPath) throw new Error("VAULT_PATH env var is not set");

  const absPath = path.join(vaultPath, notePath);
  const content = fs.readFileSync(absPath, "utf-8");
  const stat = fs.statSync(absPath);
  const crypto = await import("node:crypto");
  const note = {
    relPath: notePath,
    absPath,
    mtime: stat.mtime.toISOString(),
    contentSha256: crypto.createHash("sha256").update(content).digest("hex"),
  };

  const db = getDb();
  const knownProjects = db.prepare("SELECT slug, name FROM projects").all() as KnownProject[];
  const chipRunRows = db
    .prepare(
      `SELECT cr.id, p.slug AS project_slug, p.name AS project_name, cr.label, cr.aliases
       FROM chip_runs cr JOIN projects p ON p.id = cr.project_id`,
    )
    .all() as { id: number; project_slug: string; project_name: string; label: string; aliases: string }[];
  const knownChipRuns: KnownChipRun[] = chipRunRows.map((r) => ({
    id: r.id,
    projectSlug: r.project_slug,
    projectName: r.project_name,
    label: r.label,
    aliases: JSON.parse(r.aliases),
  }));
  const recipeRows = db
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
  const knownRecipes: KnownRecipe[] = recipeRows.map((r) => ({
    category: r.category as RecipeCategory,
    recipeName: r.recipe_name,
    entryMode: r.entry_mode,
  }));

  try {
    const extraction = await extractNote({ noteContent: content, knownProjects, knownChipRuns, knownRecipes });
    const noteDate = inferNoteDate(notePath.split("/").pop()!);
    upsertNoteExtraction(extraction, notePath, noteDate);
    markNoteProcessed(note, "success", { model: "claude-sonnet-5 (via claude -p, manual reprocess)" });
    console.log(
      JSON.stringify({
        ok: true,
        chipRuns: extraction.chip_runs.length,
        recipeEntries: extraction.recipe_entries.length,
      }),
    );
  } catch (err) {
    markNoteProcessed(note, "error", { error: (err as Error).message });
    console.log(JSON.stringify({ ok: false, error: (err as Error).message }));
    process.exit(1);
  }
}

main().catch((err) => {
  console.log(JSON.stringify({ ok: false, error: String(err) }));
  process.exit(1);
});
