export type StageType =
  | "cleaning"
  | "resist_coating"
  | "e_beam_lithography"
  | "development"
  | "etching"
  | "deposition"
  | "dicing"
  | "delivery"
  | "completed_other"
  | "other";

export type StageStatus = "pending" | "in_progress" | "complete" | "blocked" | "skipped";

export interface ExtractedPhoto {
  filename: string;
  caption: string | null;
}

export interface ExtractedStage {
  stage_type: StageType;
  status: StageStatus;
  blocked_reason: string | null;
  note: string;
  photos: ExtractedPhoto[];
}

export interface ExtractedChipRun {
  project_slug: string | null;
  is_new: boolean;
  match_hint: string;
  label: string;
  confidence: number;
  stages: ExtractedStage[];
}

export type RecipeCategory =
  | "etching"
  | "deposition"
  | "lithography"
  | "photolithography"
  | "development"
  | "cleaning_coating"
  | "other";

export interface ExtractedRecipeEntry {
  category: RecipeCategory;
  recipe_name: string;
  entry_date: string;
  params: Record<string, unknown>;
  source_excerpt: string;
}

export interface NoteExtraction {
  chip_runs: ExtractedChipRun[];
  recipe_entries: ExtractedRecipeEntry[];
}

export interface KnownChipRun {
  id: number;
  projectSlug: string;
  projectName: string;
  label: string;
  aliases: string[];
}

export interface KnownProject {
  slug: string;
  name: string;
}

/**
 * An already-established recipe (from recipe_definitions and/or existing
 * recipe_entries). Given as a roster so the LLM reuses the exact existing
 * `recipe_name` for a matching process instead of inventing a fresh name
 * from whatever materials/steps happen to be mentioned in a given note.
 *
 * `entryMode: "log_only"` means the admin has flagged it as needing no
 * per-entry params at all — its fixed conditions and per-run variations are
 * all kept in the admin-authored description/비고, so entries for it should
 * record just `entry_date` (+ empty `params`/`source_excerpt`).
 */
export interface KnownRecipe {
  category: RecipeCategory;
  recipeName: string;
  entryMode: "full" | "log_only";
}
