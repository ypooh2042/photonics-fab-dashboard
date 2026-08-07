import fs from "node:fs";
import path from "node:path";
import { getDb } from "./db.js";
import { extractNote } from "./extract.js";
import type { KnownChipRun, KnownProject, KnownRecipe, RecipeCategory } from "./types.js";

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

async function main() {
  const args = process.argv.slice(2);
  const noteIdx = args.indexOf("--note");
  if (noteIdx === -1 || !args[noteIdx + 1]) {
    console.error('Usage: cli-dry-run.ts --note "<filename in 2026/>"');
    process.exit(1);
  }
  const filename = args[noteIdx + 1];
  const vaultPath = process.env.VAULT_PATH;
  if (!vaultPath) throw new Error("VAULT_PATH env var is not set");
  const notePath = path.join(vaultPath, "2026", filename);
  const content = fs.readFileSync(notePath, "utf-8");

  const knownChipRuns = allKnownChipRuns();

  console.error(`[dry-run] note: ${filename}`);
  console.error(`[dry-run] known chip runs: ${knownChipRuns.length}`);
  console.error(`[dry-run] calling Claude Sonnet...`);

  const result = await extractNote({
    noteContent: content,
    knownProjects: allKnownProjects(),
    knownChipRuns,
    knownRecipes: allKnownRecipes(),
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
