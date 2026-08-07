import { getDb } from "./db";

export interface ChipRunSummary {
  id: number;
  label: string;
  projectName: string;
  projectSlug: string;
  status: string;
  lastUpdatedDate: string;
  needsReview: boolean;
  stageCounts: { total: number; complete: number; blocked: number };
}

export function listChipRuns(): ChipRunSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT cr.id, cr.label, cr.status, cr.last_updated_date, cr.needs_review,
              p.name AS project_name, p.slug AS project_slug
       FROM chip_runs cr JOIN projects p ON p.id = cr.project_id
       ORDER BY cr.label DESC`,
    )
    .all() as {
    id: number;
    label: string;
    status: string;
    last_updated_date: string;
    needs_review: number;
    project_name: string;
    project_slug: string;
  }[];

  const stageStmt = db.prepare(
    `SELECT status, COUNT(*) as n FROM pipeline_stage_instances WHERE chip_run_id = ? GROUP BY status`,
  );

  return rows.map((r) => {
    const stageRows = stageStmt.all(r.id) as { status: string; n: number }[];
    const total = stageRows.reduce((s, x) => s + x.n, 0);
    const complete = stageRows
      .filter((x) => x.status === "complete" || x.status === "skipped")
      .reduce((s, x) => s + x.n, 0);
    const blocked = stageRows.find((x) => x.status === "blocked")?.n ?? 0;
    return {
      id: r.id,
      label: r.label,
      projectName: r.project_name,
      projectSlug: r.project_slug,
      status: r.status,
      lastUpdatedDate: r.last_updated_date,
      needsReview: !!r.needs_review,
      stageCounts: { total, complete, blocked },
    };
  });
}

export interface StageInstanceDetail {
  id: number;
  seq: number;
  stageType: string;
  label: string | null;
  status: string;
  blockedReason: string | null;
  startedDate: string | null;
  completedDate: string | null;
  photos: { crpId: number; id: number; filename: string; caption: string | null }[];
}

export interface ChipRunDetail {
  id: number;
  label: string;
  aliases: string[];
  projectName: string;
  projectSlug: string;
  status: string;
  firstSeenDate: string;
  lastUpdatedDate: string;
  needsReview: boolean;
  llmConfidence: number | null;
  stages: StageInstanceDetail[];
}

export function getChipRunDetail(id: number): ChipRunDetail | null {
  const db = getDb();
  const cr = db
    .prepare(
      `SELECT cr.*, p.name AS project_name, p.slug AS project_slug
       FROM chip_runs cr JOIN projects p ON p.id = cr.project_id WHERE cr.id = ?`,
    )
    .get(id) as
    | {
        id: number;
        label: string;
        aliases: string;
        status: string;
        first_seen_date: string;
        last_updated_date: string;
        needs_review: number;
        llm_confidence: number | null;
        project_name: string;
        project_slug: string;
      }
    | undefined;
  if (!cr) return null;

  const stages = db
    .prepare(
      `SELECT id, seq, stage_type, label, status, blocked_reason, started_date, completed_date
       FROM pipeline_stage_instances WHERE chip_run_id = ? ORDER BY sort_order ASC, id ASC`,
    )
    .all(id) as {
    id: number;
    seq: number;
    stage_type: string;
    label: string | null;
    status: string;
    blocked_reason: string | null;
    started_date: string | null;
    completed_date: string | null;
  }[];

  const photoStmt = db.prepare(
    `SELECT crp.id AS crp_id, ph.id, ph.filename, crp.caption FROM chip_run_photos crp
     JOIN photos ph ON ph.id = crp.photo_id
     WHERE crp.chip_run_id = ? AND crp.stage_instance_id = ?
     ORDER BY crp.sort_order ASC, crp.id ASC`,
  );

  return {
    id: cr.id,
    label: cr.label,
    aliases: JSON.parse(cr.aliases),
    projectName: cr.project_name,
    projectSlug: cr.project_slug,
    status: cr.status,
    firstSeenDate: cr.first_seen_date,
    lastUpdatedDate: cr.last_updated_date,
    needsReview: !!cr.needs_review,
    llmConfidence: cr.llm_confidence,
    stages: stages.map((s) => ({
      id: s.id,
      seq: s.seq,
      stageType: s.stage_type,
      label: s.label,
      status: s.status,
      blockedReason: s.blocked_reason,
      startedDate: s.started_date,
      completedDate: s.completed_date,
      photos: (
        photoStmt.all(id, s.id) as { crp_id: number; id: number; filename: string; caption: string | null }[]
      ).map((p) => ({ crpId: p.crp_id, id: p.id, filename: p.filename, caption: p.caption })),
    })),
  };
}

export interface RecipeCategorySummary {
  slug: string;
  name: string;
  recipeCount: number;
  entryCount: number;
}

export function listRecipeCategories(): RecipeCategorySummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT rc.slug, rc.name,
              COUNT(DISTINCT re.recipe_name) AS recipe_count,
              COUNT(re.id) AS entry_count
       FROM recipe_categories rc
       LEFT JOIN recipe_entries re ON re.category_id = rc.id
       GROUP BY rc.id ORDER BY rc.sort_order ASC, rc.id ASC`,
    )
    .all() as { slug: string; name: string; recipe_count: number; entry_count: number }[];
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    recipeCount: r.recipe_count,
    entryCount: r.entry_count,
  }));
}

export interface RecipeSummary {
  recipeName: string;
  entryCount: number;
  lastEntryDate: string | null;
}

/** Recipes with entries, plus recipes that only exist as an admin-authored description with no entries yet. */
export function listRecipesInCategory(categorySlug: string): RecipeSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT names.recipe_name, COALESCE(cnt.entry_count, 0) AS entry_count, cnt.last_entry_date
       FROM (
         SELECT re.recipe_name FROM recipe_entries re JOIN recipe_categories rc ON rc.id = re.category_id
         WHERE rc.slug = ?
         UNION
         SELECT rd.recipe_name FROM recipe_definitions rd JOIN recipe_categories rc ON rc.id = rd.category_id
         WHERE rc.slug = ?
       ) names
       LEFT JOIN (
         SELECT re.recipe_name, COUNT(*) AS entry_count, MAX(re.entry_date) AS last_entry_date
         FROM recipe_entries re JOIN recipe_categories rc ON rc.id = re.category_id
         WHERE rc.slug = ? GROUP BY re.recipe_name
       ) cnt ON cnt.recipe_name = names.recipe_name
       ORDER BY cnt.last_entry_date IS NULL, cnt.last_entry_date DESC, names.recipe_name ASC`,
    )
    .all(categorySlug, categorySlug, categorySlug) as {
    recipe_name: string;
    entry_count: number;
    last_entry_date: string | null;
  }[];

  return rows.map((r) => ({
    recipeName: r.recipe_name,
    entryCount: r.entry_count,
    lastEntryDate: r.last_entry_date,
  }));
}

/** The recipe's fixed, admin-authored steps/parameters — the canonical reference every entry's params should not repeat. */
export function getRecipeDescription(categorySlug: string, recipeName: string): string | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT rd.description FROM recipe_definitions rd JOIN recipe_categories rc ON rc.id = rd.category_id
       WHERE rc.slug = ? AND rd.recipe_name = ?`,
    )
    .get(categorySlug, recipeName) as { description: string | null } | undefined;
  return row?.description ?? null;
}

export type RecipeEntryMode = "full" | "log_only";

/**
 * 'full' (default): entries carry LLM-extracted per-run params, shown as a param table + trend chart.
 * 'log_only': everything about the recipe lives in its description; entries just log entry_date, no params.
 */
export function getRecipeEntryMode(categorySlug: string, recipeName: string): RecipeEntryMode {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT rd.entry_mode FROM recipe_definitions rd JOIN recipe_categories rc ON rc.id = rd.category_id
       WHERE rc.slug = ? AND rd.recipe_name = ?`,
    )
    .get(categorySlug, recipeName) as { entry_mode: RecipeEntryMode } | undefined;
  return row?.entry_mode ?? "full";
}

/** True if a recipe has been created at all — either it has entries, or it exists as a description-only definition. */
export function recipeExists(categorySlug: string, recipeName: string): boolean {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT 1 FROM recipe_definitions rd JOIN recipe_categories rc ON rc.id = rd.category_id
       WHERE rc.slug = ? AND rd.recipe_name = ?
       UNION
       SELECT 1 FROM recipe_entries re JOIN recipe_categories rc ON rc.id = re.category_id
       WHERE rc.slug = ? AND re.recipe_name = ?`,
    )
    .get(categorySlug, recipeName, categorySlug, recipeName);
  return !!row;
}

export interface RecipeEntryRow {
  id: number;
  entryDate: string;
  params: Record<string, unknown>;
  sourceExcerpt: string;
  sourceNotePath: string;
}

/**
 * If a raw `selectivity` wasn't extracted but before/after-strip alphastep
 * step-height data is present, derive it: remaining resist = pre-strip step
 * height - etch depth; erosion = reference resist thickness - remaining;
 * selectivity = etch depth / erosion. Reference thickness only ever comes
 * from the entry's own explicit `resist_thickness_nm` — there is
 * deliberately no fallback to a resist-type-keyed lookup elsewhere (e.g. a
 * dose-preset table), since that couples this calculation to a name that
 * can be renamed independently and silently break it. No explicit
 * `resist_thickness_nm` on the entry just means no derived selectivity.
 *
 * `etch_depth_nm` itself may be missing when the note only records the
 * post-strip step height directly — once the resist is stripped, that
 * measured step height *is* the etch depth, so it's used as a fallback.
 */
function withDerivedSelectivity(params: Record<string, unknown>): Record<string, unknown> {
  let working = params;
  if (typeof working.etch_depth_nm !== "number" && typeof working.post_strip_step_height_nm === "number") {
    working = { ...working, etch_depth_nm: working.post_strip_step_height_nm };
  }

  if (typeof working.selectivity === "number") return working;

  const preStrip = working.pre_strip_step_height_nm;
  const etchDepth = working.etch_depth_nm;
  if (typeof preStrip !== "number" || typeof etchDepth !== "number") return working;

  const referenceThickness = working.resist_thickness_nm;
  if (typeof referenceThickness !== "number") return working;

  const remaining = preStrip - etchDepth;
  const erosion = referenceThickness - remaining;
  if (erosion <= 0) return working;

  return { ...working, selectivity: etchDepth / erosion, selectivity_derived: true };
}

export function getRecipeEntries(categorySlug: string, recipeName: string): RecipeEntryRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT re.id, re.entry_date, re.params, re.source_excerpt, re.source_note_path
       FROM recipe_entries re JOIN recipe_categories rc ON rc.id = re.category_id
       WHERE rc.slug = ? AND re.recipe_name = ? ORDER BY re.entry_date ASC, re.id ASC`,
    )
    .all(categorySlug, recipeName) as {
    id: number;
    entry_date: string;
    params: string;
    source_excerpt: string;
    source_note_path: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    entryDate: r.entry_date,
    params: withDerivedSelectivity(JSON.parse(r.params)),
    sourceExcerpt: r.source_excerpt,
    sourceNotePath: r.source_note_path,
  }));
}
