import fs from "node:fs";
import path from "node:path";
import { getDb } from "./db";
import { logAudit } from "./audit";
import { rebalancePermanentCapacities } from "./equipment-users";
import type { StageType, StageStatus } from "./stage-constants";

const ADMIN_PHOTO_UPLOADS_DIR = path.resolve(process.cwd(), "../../data/admin-photo-uploads");

export interface StageUpdateInput {
  status?: StageStatus;
  blockedReason?: string | null;
  label?: string | null;
  startedDate?: string | null;
  completedDate?: string | null;
}

export function updateStage(stageId: number, input: StageUpdateInput): void {
  const db = getDb();
  const before = db.prepare("SELECT * FROM pipeline_stage_instances WHERE id = ?").get(stageId);
  if (!before) throw new Error("stage not found");

  const hasLabel = Object.prototype.hasOwnProperty.call(input, "label");
  const hasBlockedReason = Object.prototype.hasOwnProperty.call(input, "blockedReason");
  const hasStartedDate = Object.prototype.hasOwnProperty.call(input, "startedDate");
  const hasCompletedDate = Object.prototype.hasOwnProperty.call(input, "completedDate");

  db.prepare(
    `UPDATE pipeline_stage_instances SET
       status = COALESCE(@status, status),
       blocked_reason = CASE WHEN @has_blocked_reason THEN @blocked_reason ELSE blocked_reason END,
       label = CASE WHEN @has_label THEN @label ELSE label END,
       started_date = CASE WHEN @has_started_date THEN @started_date
                            ELSE started_date END,
       completed_date = CASE WHEN @has_completed_date THEN @completed_date
                              WHEN @status = 'complete' THEN COALESCE(completed_date, date('now'))
                              ELSE completed_date END,
       updated_at = datetime('now')
     WHERE id = @id`,
  ).run({
    id: stageId,
    status: input.status ?? null,
    has_blocked_reason: hasBlockedReason ? 1 : 0,
    blocked_reason: input.blockedReason ?? null,
    has_label: hasLabel ? 1 : 0,
    label: input.label ?? null,
    has_started_date: hasStartedDate ? 1 : 0,
    started_date: input.startedDate ?? null,
    has_completed_date: hasCompletedDate ? 1 : 0,
    completed_date: input.completedDate ?? null,
  });

  const after = db.prepare("SELECT * FROM pipeline_stage_instances WHERE id = ?").get(stageId) as {
    chip_run_id: number;
    stage_type: string;
    status: string;
  };
  logAudit("update_stage", "pipeline_stage_instance", stageId, before, after);

  // A completed "delivery" stage, or a "completed_other" stage (run closed out
  // for a reason other than physical delivery), marks the whole chip run as done.
  if (
    (after.stage_type === "delivery" || after.stage_type === "completed_other") &&
    after.status === "complete"
  ) {
    db.prepare("UPDATE chip_runs SET status = 'complete', updated_at = datetime('now') WHERE id = ?").run(
      after.chip_run_id,
    );
  }
}

/** Recomputes each stage's per-type occurrence number (seq) from its current display position (sort_order). */
function renumberSeq(chipRunId: number): void {
  const db = getDb();
  const stages = db
    .prepare(
      "SELECT id, stage_type FROM pipeline_stage_instances WHERE chip_run_id = ? ORDER BY sort_order ASC, id ASC",
    )
    .all(chipRunId) as { id: number; stage_type: string }[];

  const counters: Record<string, number> = {};
  const update = db.prepare("UPDATE pipeline_stage_instances SET seq = ? WHERE id = ?");
  const tx = db.transaction(() => {
    for (const s of stages) {
      counters[s.stage_type] = (counters[s.stage_type] ?? 0) + 1;
      update.run(counters[s.stage_type], s.id);
    }
  });
  tx();
}

export function addStage(
  chipRunId: number,
  stageType: StageType,
  label: string | null,
): number {
  const db = getDb();
  const maxSeq = db
    .prepare(
      "SELECT COALESCE(MAX(seq), 0) AS m FROM pipeline_stage_instances WHERE chip_run_id = ? AND stage_type = ?",
    )
    .get(chipRunId, stageType) as { m: number };
  const maxSortOrder = db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) AS m FROM pipeline_stage_instances WHERE chip_run_id = ?")
    .get(chipRunId) as { m: number };

  const result = db
    .prepare(
      `INSERT INTO pipeline_stage_instances (chip_run_id, seq, sort_order, stage_type, label, status, source_note_paths)
       VALUES (?, ?, ?, ?, ?, 'pending', '[]')`,
    )
    .run(chipRunId, maxSeq.m + 1, maxSortOrder.m + 1, stageType, label);

  const id = Number(result.lastInsertRowid);
  logAudit("add_stage", "pipeline_stage_instance", id, null, { chipRunId, stageType, label });
  return id;
}

/** Swaps a stage's display position with its immediate neighbor within the same chip run. */
export function reorderStage(stageId: number, direction: "up" | "down"): void {
  const db = getDb();
  const stage = db
    .prepare("SELECT id, chip_run_id, sort_order FROM pipeline_stage_instances WHERE id = ?")
    .get(stageId) as { id: number; chip_run_id: number; sort_order: number } | undefined;
  if (!stage) throw new Error("stage not found");

  const neighbor = db
    .prepare(
      direction === "up"
        ? `SELECT id, sort_order FROM pipeline_stage_instances
           WHERE chip_run_id = ? AND sort_order < ? ORDER BY sort_order DESC LIMIT 1`
        : `SELECT id, sort_order FROM pipeline_stage_instances
           WHERE chip_run_id = ? AND sort_order > ? ORDER BY sort_order ASC LIMIT 1`,
    )
    .get(stage.chip_run_id, stage.sort_order) as { id: number; sort_order: number } | undefined;
  if (!neighbor) return;

  const tx = db.transaction(() => {
    db.prepare("UPDATE pipeline_stage_instances SET sort_order = ?, updated_at = datetime('now') WHERE id = ?").run(
      neighbor.sort_order,
      stage.id,
    );
    db.prepare("UPDATE pipeline_stage_instances SET sort_order = ?, updated_at = datetime('now') WHERE id = ?").run(
      stage.sort_order,
      neighbor.id,
    );
  });
  tx();
  renumberSeq(stage.chip_run_id);

  logAudit(
    "reorder_stage",
    "pipeline_stage_instance",
    stageId,
    { sortOrder: stage.sort_order },
    { sortOrder: neighbor.sort_order },
  );
}

/** Sets the full stage order for a chip run in one go (drag-and-drop reorder). `orderedStageIds` must contain exactly the chip run's current stage ids. */
export function reorderStages(chipRunId: number, orderedStageIds: number[]): void {
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM pipeline_stage_instances WHERE chip_run_id = ?")
    .all(chipRunId) as { id: number }[];
  const existingIds = new Set(existing.map((s) => s.id));
  if (orderedStageIds.length !== existingIds.size || orderedStageIds.some((id) => !existingIds.has(id))) {
    throw new Error("orderedStageIds must match the chip run's current stages");
  }

  const update = db.prepare(
    "UPDATE pipeline_stage_instances SET sort_order = ?, updated_at = datetime('now') WHERE id = ?",
  );
  const tx = db.transaction(() => {
    orderedStageIds.forEach((id, idx) => update.run(idx + 1, id));
  });
  tx();
  renumberSeq(chipRunId);

  logAudit("reorder_stages", "chip_run", chipRunId, null, { order: orderedStageIds });
}

export function deleteStage(stageId: number): void {
  const db = getDb();
  const before = db.prepare("SELECT * FROM pipeline_stage_instances WHERE id = ?").get(stageId) as
    | { chip_run_id: number }
    | undefined;
  if (!before) return;
  db.prepare("DELETE FROM pipeline_stage_instances WHERE id = ?").run(stageId);
  renumberSeq(before.chip_run_id);
  logAudit("delete_stage", "pipeline_stage_instance", stageId, before, null);
}

export function clearChipRunReview(chipRunId: number): void {
  const db = getDb();
  const before = db.prepare("SELECT * FROM chip_runs WHERE id = ?").get(chipRunId);
  db.prepare("UPDATE chip_runs SET needs_review = 0, updated_at = datetime('now') WHERE id = ?").run(chipRunId);
  const after = db.prepare("SELECT * FROM chip_runs WHERE id = ?").get(chipRunId);
  logAudit("clear_review", "chip_run", chipRunId, before, after);
}

export function updateChipRunLabel(chipRunId: number, label: string): void {
  const db = getDb();
  const before = db.prepare("SELECT * FROM chip_runs WHERE id = ?").get(chipRunId);
  db.prepare("UPDATE chip_runs SET label = ?, updated_at = datetime('now') WHERE id = ?").run(label, chipRunId);
  const after = db.prepare("SELECT * FROM chip_runs WHERE id = ?").get(chipRunId);
  logAudit("update_label", "chip_run", chipRunId, before, after);
}

export function updateChipRunProject(chipRunId: number, projectId: number): void {
  const db = getDb();
  const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);
  if (!project) throw new Error("project not found");
  const before = db.prepare("SELECT * FROM chip_runs WHERE id = ?").get(chipRunId);
  if (!before) throw new Error("chip run not found");
  db.prepare("UPDATE chip_runs SET project_id = ?, updated_at = datetime('now') WHERE id = ?").run(
    projectId,
    chipRunId,
  );
  const after = db.prepare("SELECT * FROM chip_runs WHERE id = ?").get(chipRunId);
  logAudit("update_project", "chip_run", chipRunId, before, after);
}

export interface RecipeEntryUpdateInput {
  recipeName?: string;
  params?: Record<string, unknown>;
  sourceExcerpt?: string;
}

export function updateRecipeEntry(entryId: number, input: RecipeEntryUpdateInput): void {
  const db = getDb();
  const before = db.prepare("SELECT * FROM recipe_entries WHERE id = ?").get(entryId);
  if (!before) throw new Error("recipe entry not found");

  db.prepare(
    `UPDATE recipe_entries SET
       recipe_name = COALESCE(@recipe_name, recipe_name),
       params = COALESCE(@params, params),
       source_excerpt = CASE WHEN @has_source_excerpt THEN @source_excerpt ELSE source_excerpt END,
       needs_review = 0
     WHERE id = @id`,
  ).run({
    id: entryId,
    recipe_name: input.recipeName ?? null,
    params: input.params ? JSON.stringify(input.params) : null,
    has_source_excerpt: Object.prototype.hasOwnProperty.call(input, "sourceExcerpt") ? 1 : 0,
    source_excerpt: input.sourceExcerpt ?? null,
  });

  const after = db.prepare("SELECT * FROM recipe_entries WHERE id = ?").get(entryId);
  logAudit("update_recipe_entry", "recipe_entry", entryId, before, after);
}

export interface ReviewChipRun {
  id: number;
  label: string;
  projectName: string;
  llmConfidence: number | null;
}

export function listNeedsReviewChipRuns(): ReviewChipRun[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT cr.id, cr.label, cr.llm_confidence, p.name AS project_name
       FROM chip_runs cr JOIN projects p ON p.id = cr.project_id
       WHERE cr.needs_review = 1 ORDER BY cr.llm_confidence ASC`,
    )
    .all() as { id: number; label: string; llm_confidence: number | null; project_name: string }[];
  return rows.map((r) => ({ id: r.id, label: r.label, projectName: r.project_name, llmConfidence: r.llm_confidence }));
}

export interface ReviewRecipeEntry {
  id: number;
  recipeName: string;
  categoryName: string;
  entryDate: string;
  sourceExcerpt: string;
}

export function listNeedsReviewRecipeEntries(): ReviewRecipeEntry[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT re.id, re.recipe_name, re.entry_date, re.source_excerpt, rc.name AS category_name
       FROM recipe_entries re JOIN recipe_categories rc ON rc.id = re.category_id
       WHERE re.needs_review = 1 ORDER BY re.entry_date DESC`,
    )
    .all() as { id: number; recipe_name: string; entry_date: string; source_excerpt: string; category_name: string }[];
  return rows.map((r) => ({
    id: r.id,
    recipeName: r.recipe_name,
    categoryName: r.category_name,
    entryDate: r.entry_date,
    sourceExcerpt: r.source_excerpt,
  }));
}

export interface IngestionStateRow {
  notePath: string;
  mtime: string;
  lastProcessedAt: string | null;
  status: string | null;
  error: string | null;
  consecutiveFailures: number;
}

export function listIngestionState(): IngestionStateRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT note_path, mtime, last_processed_at, last_extraction_status, last_extraction_error, consecutive_failures
       FROM note_ingestion_state ORDER BY last_processed_at DESC`,
    )
    .all() as {
    note_path: string;
    mtime: string;
    last_processed_at: string | null;
    last_extraction_status: string | null;
    last_extraction_error: string | null;
    consecutive_failures: number;
  }[];
  return rows.map((r) => ({
    notePath: r.note_path,
    mtime: r.mtime,
    lastProcessedAt: r.last_processed_at,
    status: r.last_extraction_status,
    error: r.last_extraction_error,
    consecutiveFailures: r.consecutive_failures,
  }));
}

export interface WeeklySettingsUpdate {
  weeklyCapacityHours?: number;
  cutoverDayOfWeek?: number;
  cutoverHour?: number;
  cutoverMinute?: number;
  loadingCostMinutes?: number;
  calibrationCostMinutes?: number;
  perLayerCostSeconds?: number;
  minDwellNs?: number;
  dwellMarginRatio?: number;
}

export function updateWeeklySettings(input: WeeklySettingsUpdate): void {
  const db = getDb();
  const before = db.prepare("SELECT * FROM weekly_schedule_settings WHERE id = 1").get();

  db.prepare(
    `UPDATE weekly_schedule_settings SET
       weekly_capacity_hours = COALESCE(@capacity, weekly_capacity_hours),
       cutover_day_of_week = COALESCE(@dow, cutover_day_of_week),
       cutover_hour_local = COALESCE(@hour, cutover_hour_local),
       cutover_minute_local = COALESCE(@minute, cutover_minute_local),
       loading_cost_minutes = COALESCE(@loading, loading_cost_minutes),
       calibration_cost_minutes = COALESCE(@calibration, calibration_cost_minutes),
       per_layer_cost_seconds = COALESCE(@per_layer, per_layer_cost_seconds),
       min_dwell_ns = COALESCE(@min_dwell_ns, min_dwell_ns),
       dwell_margin_ratio = COALESCE(@dwell_margin_ratio, dwell_margin_ratio),
       updated_at = datetime('now')
     WHERE id = 1`,
  ).run({
    capacity: input.weeklyCapacityHours ?? null,
    dow: input.cutoverDayOfWeek ?? null,
    hour: input.cutoverHour ?? null,
    minute: input.cutoverMinute ?? null,
    loading: input.loadingCostMinutes ?? null,
    calibration: input.calibrationCostMinutes ?? null,
    per_layer: input.perLayerCostSeconds ?? null,
    min_dwell_ns: input.minDwellNs ?? null,
    dwell_margin_ratio: input.dwellMarginRatio ?? null,
  });

  const after = db.prepare("SELECT * FROM weekly_schedule_settings WHERE id = 1").get();
  logAudit("update_settings", "weekly_schedule_settings", 1, before, after);

  // A total-capacity change reshuffles every permanent equipment user's even
  // share (rebalancePermanentCapacities also propagates it into the open
  // week and recomputes colors for each of them). loadingCostMinutes here is
  // only the seed value for newly created equipment users now — each
  // existing user's own equipment_users.loading_cost_minutes drives their
  // schedule (see queue.ts), so changing the global default doesn't need a
  // recompute.
  if (input.weeklyCapacityHours != null) {
    rebalancePermanentCapacities();
  }
}

export interface ResistDoseRow {
  resistType: string;
  referenceDoseUcCm2: number;
  notes: string | null;
  referenceThicknessNm: number | null;
  isDefault: boolean;
}

/** The presets behind the submit page's dose combobox: display name (resistType) + the dose value applied on selection. */
export function listResistDoses(): ResistDoseRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT resist_type, reference_dose_uc_cm2, notes, reference_thickness_nm, is_default FROM resist_reference_doses ORDER BY resist_type ASC",
    )
    .all() as {
    resist_type: string;
    reference_dose_uc_cm2: number;
    notes: string | null;
    reference_thickness_nm: number | null;
    is_default: number;
  }[];
  return rows.map((r) => ({
    resistType: r.resist_type,
    referenceDoseUcCm2: r.reference_dose_uc_cm2,
    notes: r.notes,
    referenceThicknessNm: r.reference_thickness_nm,
    isDefault: r.is_default === 1,
  }));
}

export function createResistDose(input: {
  resistType: string;
  referenceDoseUcCm2: number;
  notes?: string | null;
  referenceThicknessNm?: number | null;
}): void {
  const db = getDb();
  const existing = db
    .prepare("SELECT 1 FROM resist_reference_doses WHERE resist_type = ?")
    .get(input.resistType);
  if (existing) throw new Error("이미 존재하는 이름입니다");

  db.prepare(
    `INSERT INTO resist_reference_doses (resist_type, reference_dose_uc_cm2, notes, reference_thickness_nm)
     VALUES (@resist_type, @dose, @notes, @thickness)`,
  ).run({
    resist_type: input.resistType,
    dose: input.referenceDoseUcCm2,
    notes: input.notes ?? null,
    thickness: input.referenceThicknessNm ?? null,
  });
  logAudit("create_resist_dose", "resist_reference_doses", null, null, input);
}

export interface ResistDoseUpdateInput {
  resistType?: string;
  referenceDoseUcCm2?: number;
  notes?: string | null;
  referenceThicknessNm?: number | null;
  isDefault?: boolean;
}

/** resist_type doubles as the primary key, so a rename is a keyed UPDATE of that column itself (no FK references it, so this is safe) rather than a delete+recreate. */
export function updateResistDose(resistType: string, input: ResistDoseUpdateInput): void {
  const db = getDb();
  const before = db.prepare("SELECT * FROM resist_reference_doses WHERE resist_type = ?").get(resistType);
  if (!before) throw new Error("존재하지 않는 이름입니다");

  const renamedTo = input.resistType?.trim();
  if (renamedTo && renamedTo !== resistType) {
    const clash = db.prepare("SELECT 1 FROM resist_reference_doses WHERE resist_type = ?").get(renamedTo);
    if (clash) throw new Error("이미 존재하는 이름입니다");
  }
  const finalResistType = renamedTo || resistType;

  db.transaction(() => {
    if (finalResistType !== resistType) {
      db.prepare("UPDATE resist_reference_doses SET resist_type = ? WHERE resist_type = ?").run(finalResistType, resistType);
    }
    db.prepare(
      `UPDATE resist_reference_doses SET
         reference_dose_uc_cm2 = COALESCE(@dose, reference_dose_uc_cm2),
         notes = CASE WHEN @has_notes THEN @notes ELSE notes END,
         reference_thickness_nm = CASE WHEN @has_thickness THEN @thickness ELSE reference_thickness_nm END
       WHERE resist_type = @resist_type`,
    ).run({
      resist_type: finalResistType,
      dose: input.referenceDoseUcCm2 ?? null,
      has_notes: Object.prototype.hasOwnProperty.call(input, "notes") ? 1 : 0,
      notes: input.notes ?? null,
      has_thickness: Object.prototype.hasOwnProperty.call(input, "referenceThicknessNm") ? 1 : 0,
      thickness: input.referenceThicknessNm ?? null,
    });
    if (input.isDefault === true) {
      db.prepare("UPDATE resist_reference_doses SET is_default = 0").run();
      db.prepare("UPDATE resist_reference_doses SET is_default = 1 WHERE resist_type = ?").run(finalResistType);
    }
  })();

  const after = db.prepare("SELECT * FROM resist_reference_doses WHERE resist_type = ?").get(finalResistType);
  logAudit("update_resist_dose", "resist_reference_doses", null, before, after);
}

export function deleteResistDose(resistType: string): void {
  const db = getDb();
  const before = db.prepare("SELECT * FROM resist_reference_doses WHERE resist_type = ?").get(resistType) as
    | { is_default: number }
    | undefined;
  if (!before) return;
  db.transaction(() => {
    db.prepare("DELETE FROM resist_reference_doses WHERE resist_type = ?").run(resistType);
    // Deleting the current default must never leave the submit page's dose combobox without one.
    if (before.is_default === 1) {
      const fallback = db.prepare("SELECT resist_type FROM resist_reference_doses ORDER BY resist_type ASC LIMIT 1").get() as
        | { resist_type: string }
        | undefined;
      if (fallback) db.prepare("UPDATE resist_reference_doses SET is_default = 1 WHERE resist_type = ?").run(fallback.resist_type);
    }
  })();
  logAudit("delete_resist_dose", "resist_reference_doses", null, before, null);
}

export interface EbeamCurrentRow {
  currentNa: number;
  label: string;
  sortOrder: number;
  isDefault: boolean;
}

/** The presets behind the submit page's E-beam Current combobox: display name (label) + the current value applied on selection. */
export function listEbeamCurrents(): EbeamCurrentRow[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT current_na, label, sort_order, is_default FROM ebeam_currents ORDER BY current_na ASC")
    .all() as { current_na: number; label: string; sort_order: number; is_default: number }[];
  return rows.map((r) => ({ currentNa: r.current_na, label: r.label, sortOrder: r.sort_order, isDefault: r.is_default === 1 }));
}

export function createEbeamCurrent(input: { currentNa: number; label: string }): void {
  const db = getDb();
  const existing = db.prepare("SELECT 1 FROM ebeam_currents WHERE current_na = ?").get(input.currentNa);
  if (existing) throw new Error("이미 존재하는 current 값입니다");

  const maxSortOrder = db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS m FROM ebeam_currents").get() as {
    m: number;
  };

  db.prepare("INSERT INTO ebeam_currents (current_na, label, sort_order) VALUES (?, ?, ?)").run(
    input.currentNa,
    input.label,
    maxSortOrder.m + 1,
  );
  logAudit("create_ebeam_current", "ebeam_currents", null, null, input);
}

export interface EbeamCurrentUpdateInput {
  label?: string;
  isDefault?: boolean;
}

export function updateEbeamCurrent(currentNa: number, input: EbeamCurrentUpdateInput): void {
  const db = getDb();
  const before = db.prepare("SELECT * FROM ebeam_currents WHERE current_na = ?").get(currentNa);
  if (!before) throw new Error("존재하지 않는 current 값입니다");

  db.transaction(() => {
    db.prepare("UPDATE ebeam_currents SET label = COALESCE(@label, label) WHERE current_na = @current_na").run({
      current_na: currentNa,
      label: input.label ?? null,
    });
    if (input.isDefault === true) {
      db.prepare("UPDATE ebeam_currents SET is_default = 0").run();
      db.prepare("UPDATE ebeam_currents SET is_default = 1 WHERE current_na = ?").run(currentNa);
    }
  })();

  const after = db.prepare("SELECT * FROM ebeam_currents WHERE current_na = ?").get(currentNa);
  logAudit("update_ebeam_current", "ebeam_currents", null, before, after);
}

export function deleteEbeamCurrent(currentNa: number): void {
  const db = getDb();
  const before = db.prepare("SELECT * FROM ebeam_currents WHERE current_na = ?").get(currentNa) as
    | { is_default: number }
    | undefined;
  if (!before) return;
  db.transaction(() => {
    db.prepare("DELETE FROM ebeam_currents WHERE current_na = ?").run(currentNa);
    // Deleting the current default must never leave the submit page's E-beam current combobox without one.
    if (before.is_default === 1) {
      const fallback = db.prepare("SELECT current_na FROM ebeam_currents ORDER BY current_na ASC LIMIT 1").get() as
        | { current_na: number }
        | undefined;
      if (fallback) db.prepare("UPDATE ebeam_currents SET is_default = 1 WHERE current_na = ?").run(fallback.current_na);
    }
  })();
  logAudit("delete_ebeam_current", "ebeam_currents", null, before, null);
}

export interface ProjectRow {
  id: number;
  slug: string;
  name: string;
  chipRunCount: number;
}

export function listProjects(): ProjectRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.id, p.slug, p.name, COUNT(cr.id) AS chip_run_count
       FROM projects p LEFT JOIN chip_runs cr ON cr.project_id = p.id
       GROUP BY p.id ORDER BY p.name`,
    )
    .all() as { id: number; slug: string; name: string; chip_run_count: number }[];
  return rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name, chipRunCount: r.chip_run_count }));
}

export function createProject(slug: string, name: string): number {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM projects WHERE slug = ?").get(slug);
  if (existing) throw new Error(`project slug "${slug}" already exists`);

  const result = db.prepare("INSERT INTO projects (slug, name, vault_folder) VALUES (?, ?, ?)").run(
    slug,
    name,
    name,
  );
  const id = Number(result.lastInsertRowid);
  logAudit("create_project", "project", id, null, { slug, name });
  return id;
}

/** Cascades: chip_run_photos -> pipeline_stage_instances -> chip_runs -> project. */
export function deleteProject(projectId: number): void {
  const db = getDb();
  const before = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
  if (!before) throw new Error("project not found");

  const tx = db.transaction(() => {
    const chipRunIds = (
      db.prepare("SELECT id FROM chip_runs WHERE project_id = ?").all(projectId) as { id: number }[]
    ).map((r) => r.id);

    for (const chipRunId of chipRunIds) {
      db.prepare("DELETE FROM chip_run_photos WHERE chip_run_id = ?").run(chipRunId);
      db.prepare("DELETE FROM pipeline_stage_instances WHERE chip_run_id = ?").run(chipRunId);
    }
    db.prepare("DELETE FROM chip_runs WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
  });
  tx();

  logAudit("delete_project", "project", projectId, before, null);
}

export function createChipRun(projectId: number, label: string): number {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const result = db
    .prepare(
      `INSERT INTO chip_runs (project_id, label, aliases, first_seen_date, last_updated_date, source_note_paths)
       VALUES (?, ?, '[]', ?, ?, '[]')`,
    )
    .run(projectId, label, today, today);
  const id = Number(result.lastInsertRowid);
  logAudit("create_chip_run", "chip_run", id, null, { projectId, label });
  return id;
}

/** Cascades: chip_run_photos -> pipeline_stage_instances -> chip_run. */
export function deleteChipRun(chipRunId: number): void {
  const db = getDb();
  const before = db.prepare("SELECT * FROM chip_runs WHERE id = ?").get(chipRunId);
  if (!before) throw new Error("chip run not found");

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM chip_run_photos WHERE chip_run_id = ?").run(chipRunId);
    db.prepare("DELETE FROM pipeline_stage_instances WHERE chip_run_id = ?").run(chipRunId);
    db.prepare("DELETE FROM chip_runs WHERE id = ?").run(chipRunId);
  });
  tx();

  logAudit("delete_chip_run", "chip_run", chipRunId, before, null);
}

export function deleteRecipeEntry(entryId: number): void {
  const db = getDb();
  const before = db.prepare("SELECT * FROM recipe_entries WHERE id = ?").get(entryId);
  if (!before) return;
  db.prepare("DELETE FROM recipe_entries WHERE id = ?").run(entryId);
  logAudit("delete_recipe_entry", "recipe_entry", entryId, before, null);
}

function getCategoryId(db: ReturnType<typeof getDb>, categorySlug: string): number {
  const category = db.prepare("SELECT id FROM recipe_categories WHERE slug = ?").get(categorySlug) as
    | { id: number }
    | undefined;
  if (!category) throw new Error(`unknown category: ${categorySlug}`);
  return category.id;
}

/** Bulk-renames every entry sharing (categorySlug, oldName) to newName — for consolidating fragmented recipe names. */
export function renameRecipe(categorySlug: string, oldName: string, newName: string): number {
  const db = getDb();
  const categoryId = getCategoryId(db, categorySlug);

  const result = db
    .prepare("UPDATE recipe_entries SET recipe_name = ? WHERE category_id = ? AND recipe_name = ?")
    .run(newName, categoryId, oldName);

  // Carry the old recipe's description over only if the merge target has none yet.
  const targetHasDescription = db
    .prepare("SELECT 1 FROM recipe_definitions WHERE category_id = ? AND recipe_name = ?")
    .get(categoryId, newName);
  if (!targetHasDescription) {
    db.prepare("UPDATE recipe_definitions SET recipe_name = ? WHERE category_id = ? AND recipe_name = ?").run(
      newName,
      categoryId,
      oldName,
    );
  } else {
    db.prepare("DELETE FROM recipe_definitions WHERE category_id = ? AND recipe_name = ?").run(categoryId, oldName);
  }

  logAudit("rename_recipe", "recipe_entries", null, { categorySlug, oldName }, { newName, count: result.changes });
  return result.changes;
}

/** Deletes every entry sharing (categorySlug, recipeName) — for removing a mistakenly-created recipe entirely. */
export function deleteRecipe(categorySlug: string, recipeName: string): number {
  const db = getDb();
  const categoryId = getCategoryId(db, categorySlug);

  const result = db
    .prepare("DELETE FROM recipe_entries WHERE category_id = ? AND recipe_name = ?")
    .run(categoryId, recipeName);
  db.prepare("DELETE FROM recipe_definitions WHERE category_id = ? AND recipe_name = ?").run(categoryId, recipeName);
  logAudit("delete_recipe", "recipe_entries", null, { categorySlug, recipeName }, { count: result.changes });
  return result.changes;
}

/** Creates a brand-new recipe (definition only, no entries yet) — for documenting a recipe before it's ever used in a note. */
export function createRecipe(categorySlug: string, recipeName: string, description: string | null): void {
  const db = getDb();
  const categoryId = getCategoryId(db, categorySlug);

  const existingDefinition = db
    .prepare("SELECT 1 FROM recipe_definitions WHERE category_id = ? AND recipe_name = ?")
    .get(categoryId, recipeName);
  const existingEntry = db
    .prepare("SELECT 1 FROM recipe_entries WHERE category_id = ? AND recipe_name = ?")
    .get(categoryId, recipeName);
  if (existingDefinition || existingEntry) throw new Error("이미 존재하는 레시피 이름입니다");

  db.prepare(
    `INSERT INTO recipe_definitions (category_id, recipe_name, description, updated_at)
     VALUES (?, ?, ?, datetime('now'))`,
  ).run(categoryId, recipeName, description);

  logAudit("create_recipe", "recipe_definitions", null, null, { categorySlug, recipeName, description });
}

/** Upserts the recipe's canonical, admin-authored description of its fixed steps/parameters. */
export function updateRecipeDescription(categorySlug: string, recipeName: string, description: string): void {
  const db = getDb();
  const categoryId = getCategoryId(db, categorySlug);

  db.prepare(
    `INSERT INTO recipe_definitions (category_id, recipe_name, description, updated_at)
     VALUES (@category_id, @recipe_name, @description, datetime('now'))
     ON CONFLICT(category_id, recipe_name) DO UPDATE SET description = @description, updated_at = datetime('now')`,
  ).run({ category_id: categoryId, recipe_name: recipeName, description });

  logAudit("update_recipe_description", "recipe_definitions", null, { categorySlug, recipeName }, { description });
}

/** Sets whether this recipe's entries get LLM-extracted params ('full') or just an entry_date log ('log_only'). */
export function updateRecipeEntryMode(
  categorySlug: string,
  recipeName: string,
  entryMode: "full" | "log_only",
): void {
  const db = getDb();
  const categoryId = getCategoryId(db, categorySlug);

  db.prepare(
    `INSERT INTO recipe_definitions (category_id, recipe_name, entry_mode, updated_at)
     VALUES (@category_id, @recipe_name, @entry_mode, datetime('now'))
     ON CONFLICT(category_id, recipe_name) DO UPDATE SET entry_mode = @entry_mode, updated_at = datetime('now')`,
  ).run({ category_id: categoryId, recipe_name: recipeName, entry_mode: entryMode });

  logAudit("update_recipe_entry_mode", "recipe_definitions", null, { categorySlug, recipeName }, { entryMode });
}

export interface RecipeEventRow {
  id: number;
  eventDate: string;
  label: string;
}

/** Admin-managed markers (e.g. equipment shutdown) shown as vertical lines on this recipe's trend chart. */
export function listRecipeEvents(categorySlug: string, recipeName: string): RecipeEventRow[] {
  const db = getDb();
  const categoryId = getCategoryId(db, categorySlug);
  const rows = db
    .prepare(
      `SELECT id, event_date, label FROM recipe_events
       WHERE category_id = ? AND recipe_name = ? ORDER BY event_date ASC, id ASC`,
    )
    .all(categoryId, recipeName) as { id: number; event_date: string; label: string }[];
  return rows.map((r) => ({ id: r.id, eventDate: r.event_date, label: r.label }));
}

export function createRecipeEvent(categorySlug: string, recipeName: string, eventDate: string, label: string): void {
  const db = getDb();
  const categoryId = getCategoryId(db, categorySlug);

  const info = db
    .prepare(`INSERT INTO recipe_events (category_id, recipe_name, event_date, label) VALUES (?, ?, ?, ?)`)
    .run(categoryId, recipeName, eventDate, label);

  logAudit("create_recipe_event", "recipe_events", Number(info.lastInsertRowid), null, {
    categorySlug,
    recipeName,
    eventDate,
    label,
  });
}

export function updateRecipeEvent(eventId: number, eventDate: string, label: string): void {
  const db = getDb();
  const before = db.prepare("SELECT * FROM recipe_events WHERE id = ?").get(eventId);
  if (!before) throw new Error("존재하지 않는 이벤트입니다");

  db.prepare("UPDATE recipe_events SET event_date = ?, label = ? WHERE id = ?").run(eventDate, label, eventId);

  logAudit("update_recipe_event", "recipe_events", eventId, before, { eventDate, label });
}

export function deleteRecipeEvent(eventId: number): void {
  const db = getDb();
  const before = db.prepare("SELECT * FROM recipe_events WHERE id = ?").get(eventId);
  if (!before) return;

  db.prepare("DELETE FROM recipe_events WHERE id = ?").run(eventId);

  logAudit("delete_recipe_event", "recipe_events", eventId, before, null);
}

/** Reassigns one stage instance to a different chip run (e.g. two chip_runs that turned out to be the same real run). */
export function moveStage(stageId: number, targetChipRunId: number): void {
  const db = getDb();
  const stage = db.prepare("SELECT * FROM pipeline_stage_instances WHERE id = ?").get(stageId) as
    | { id: number; chip_run_id: number; stage_type: string }
    | undefined;
  if (!stage) throw new Error("stage not found");
  if (stage.chip_run_id === targetChipRunId) return;

  const maxSeq = db
    .prepare(
      "SELECT COALESCE(MAX(seq), 0) AS m FROM pipeline_stage_instances WHERE chip_run_id = ? AND stage_type = ?",
    )
    .get(targetChipRunId, stage.stage_type) as { m: number };
  const maxSortOrder = db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) AS m FROM pipeline_stage_instances WHERE chip_run_id = ?")
    .get(targetChipRunId) as { m: number };

  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE pipeline_stage_instances SET chip_run_id = ?, seq = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(targetChipRunId, maxSeq.m + 1, maxSortOrder.m + 1, stageId);
    db.prepare("UPDATE chip_run_photos SET chip_run_id = ? WHERE stage_instance_id = ?").run(
      targetChipRunId,
      stageId,
    );
  });
  tx();
  renumberSeq(stage.chip_run_id);
  renumberSeq(targetChipRunId);

  logAudit(
    "move_stage",
    "pipeline_stage_instance",
    stageId,
    { chipRunId: stage.chip_run_id },
    { chipRunId: targetChipRunId },
  );
}

/** Reassigns a photo to a different stage within the same chip run. */
export function movePhoto(crpId: number, targetStageId: number): void {
  const db = getDb();
  const crp = db.prepare("SELECT * FROM chip_run_photos WHERE id = ?").get(crpId) as
    | { id: number; chip_run_id: number; stage_instance_id: number | null }
    | undefined;
  if (!crp) throw new Error("photo not found");

  const targetStage = db
    .prepare("SELECT id, chip_run_id FROM pipeline_stage_instances WHERE id = ?")
    .get(targetStageId) as { id: number; chip_run_id: number } | undefined;
  if (!targetStage) throw new Error("target stage not found");
  if (targetStage.chip_run_id !== crp.chip_run_id) {
    throw new Error("target stage must belong to the same chip run");
  }
  if (targetStage.id === crp.stage_instance_id) return;

  db.prepare("UPDATE chip_run_photos SET stage_instance_id = ? WHERE id = ?").run(targetStage.id, crpId);

  logAudit(
    "move_photo",
    "chip_run_photo",
    crpId,
    { stageInstanceId: crp.stage_instance_id },
    { stageInstanceId: targetStage.id },
  );
}

/** Sets the full photo order within a stage in one go (drag-and-drop reorder). `orderedCrpIds` must contain exactly the stage's current chip_run_photos ids. */
export function reorderStagePhotos(stageId: number, orderedCrpIds: number[]): void {
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM chip_run_photos WHERE stage_instance_id = ?")
    .all(stageId) as { id: number }[];
  const existingIds = new Set(existing.map((p) => p.id));
  if (orderedCrpIds.length !== existingIds.size || orderedCrpIds.some((id) => !existingIds.has(id))) {
    throw new Error("orderedCrpIds must match the stage's current photos");
  }

  const update = db.prepare("UPDATE chip_run_photos SET sort_order = ? WHERE id = ?");
  const tx = db.transaction(() => {
    orderedCrpIds.forEach((id, idx) => update.run(idx + 1, id));
  });
  tx();

  logAudit("reorder_stage_photos", "pipeline_stage_instance", stageId, null, { order: orderedCrpIds });
}

/**
 * Registers a photo file the admin uploaded directly (already written to disk by the
 * API route) and attaches it to a stage in one step. Unlike `attachPhotoToStage`, this
 * creates a brand new `photos` row rather than reusing a vault-indexed one.
 */
export function uploadPhotoToStage(
  stageId: number,
  filename: string,
  resolvedPath: string,
  fileSize: number,
): number {
  const db = getDb();
  const stage = db.prepare("SELECT id, chip_run_id FROM pipeline_stage_instances WHERE id = ?").get(stageId) as
    | { id: number; chip_run_id: number }
    | undefined;
  if (!stage) throw new Error("stage not found");

  const photoResult = db
    .prepare(
      `INSERT INTO photos (filename, resolved_path, file_mtime, file_size) VALUES (?, ?, datetime('now'), ?)`,
    )
    .run(filename, resolvedPath, fileSize);
  const photoId = Number(photoResult.lastInsertRowid);

  const maxSortOrder = db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) AS m FROM chip_run_photos WHERE stage_instance_id = ?")
    .get(stageId) as { m: number };

  const result = db
    .prepare(
      `INSERT INTO chip_run_photos (chip_run_id, stage_instance_id, photo_id, caption, source_note_path, sort_order)
       VALUES (?, ?, ?, NULL, '(관리자 업로드)', ?)`,
    )
    .run(stage.chip_run_id, stageId, photoId, maxSortOrder.m + 1);

  const id = Number(result.lastInsertRowid);
  logAudit("upload_photo", "chip_run_photo", id, null, { stageId, photoId, filename });
  return id;
}

/**
 * Detaches a photo from a stage. If no other stage still references the same photo
 * afterward, also drops the `photos` row and unlinks the underlying file — but only when
 * that file lives under data/admin-photo-uploads (the app's own copy). A row whose
 * resolved_path still points elsewhere (not yet migrated by the ingestion side's photo
 * indexing) is left on disk untouched, since that could be the user's original vault file.
 */
export function deletePhotoAttachment(crpId: number): void {
  const db = getDb();
  const before = db.prepare("SELECT * FROM chip_run_photos WHERE id = ?").get(crpId) as
    | { photo_id: number }
    | undefined;
  if (!before) return;
  db.prepare("DELETE FROM chip_run_photos WHERE id = ?").run(crpId);
  logAudit("delete_photo_attachment", "chip_run_photo", crpId, before, null);

  const stillReferenced = db
    .prepare("SELECT 1 FROM chip_run_photos WHERE photo_id = ? LIMIT 1")
    .get(before.photo_id);
  if (stillReferenced) return;

  const photo = db.prepare("SELECT resolved_path FROM photos WHERE id = ?").get(before.photo_id) as
    | { resolved_path: string }
    | undefined;
  if (!photo) return;

  db.prepare("DELETE FROM photos WHERE id = ?").run(before.photo_id);
  logAudit("delete_photo", "photo", before.photo_id, photo, null);

  const resolved = path.resolve(photo.resolved_path);
  if (resolved.startsWith(ADMIN_PHOTO_UPLOADS_DIR + path.sep)) {
    fs.rmSync(resolved, { force: true });
  }
}

/** Moves every stage from sourceId into targetId, merges aliases/provenance, then deletes the now-empty source run. */
export function mergeChipRuns(sourceId: number, targetId: number): void {
  if (sourceId === targetId) throw new Error("cannot merge a chip run into itself");
  const db = getDb();
  const source = db.prepare("SELECT * FROM chip_runs WHERE id = ?").get(sourceId) as
    | { label: string; aliases: string; source_note_paths: string }
    | undefined;
  const target = db.prepare("SELECT * FROM chip_runs WHERE id = ?").get(targetId) as
    | { aliases: string; source_note_paths: string }
    | undefined;
  if (!source || !target) throw new Error("chip run not found");

  const stageIds = (
    db.prepare("SELECT id FROM pipeline_stage_instances WHERE chip_run_id = ?").all(sourceId) as { id: number }[]
  ).map((r) => r.id);
  for (const id of stageIds) moveStage(id, targetId);

  const mergedAliases = new Set<string>([...JSON.parse(target.aliases), source.label, ...JSON.parse(source.aliases)]);
  const mergedPaths = new Set<string>([
    ...JSON.parse(target.source_note_paths),
    ...JSON.parse(source.source_note_paths),
  ]);

  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE chip_runs SET aliases = ?, source_note_paths = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(JSON.stringify([...mergedAliases]), JSON.stringify([...mergedPaths]), targetId);
    db.prepare("DELETE FROM chip_runs WHERE id = ?").run(sourceId);
  });
  tx();

  logAudit("merge_chip_runs", "chip_run", targetId, { sourceId, sourceLabel: source.label }, { targetId });
}
