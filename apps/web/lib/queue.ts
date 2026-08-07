import fs from "node:fs";
import { getDb } from "./db";
import { logAudit } from "./audit";
import { scheduleWeek, estimateExposureTime, type Job } from "@fab-dashboard/scheduling/fcfs";
import { currentWeekId } from "@fab-dashboard/scheduling/week-boundary";
import type { GridBounds } from "./geometry";

export type { GridBounds };

export interface WeeklySettings {
  weeklyCapacityHours: number;
  cutoverDayOfWeek: number;
  cutoverHour: number;
  cutoverMinute: number;
  timezone: string;
  loadingCostMinutes: number;
  calibrationCostMinutes: number;
  perLayerCostSeconds: number;
  minDwellNs: number;
  dwellMarginRatio: number;
}

export function getWeeklySettings(): WeeklySettings {
  const db = getDb();
  const row = db.prepare("SELECT * FROM weekly_schedule_settings WHERE id = 1").get() as {
    weekly_capacity_hours: number;
    cutover_day_of_week: number;
    cutover_hour_local: number;
    cutover_minute_local: number;
    timezone: string;
    loading_cost_minutes: number;
    calibration_cost_minutes: number;
    per_layer_cost_seconds: number;
    min_dwell_ns: number;
    dwell_margin_ratio: number;
  };
  return {
    weeklyCapacityHours: row.weekly_capacity_hours,
    cutoverDayOfWeek: row.cutover_day_of_week,
    cutoverHour: row.cutover_hour_local,
    cutoverMinute: row.cutover_minute_local,
    timezone: row.timezone,
    loadingCostMinutes: row.loading_cost_minutes,
    calibrationCostMinutes: row.calibration_cost_minutes,
    perLayerCostSeconds: row.per_layer_cost_seconds,
    minDwellNs: row.min_dwell_ns,
    dwellMarginRatio: row.dwell_margin_ratio,
  };
}

function getCurrentWeekId(settings: WeeklySettings = getWeeklySettings()): string {
  return currentWeekId(
    {
      cutoverDayOfWeek: settings.cutoverDayOfWeek,
      cutoverHour: settings.cutoverHour,
      cutoverMinute: settings.cutoverMinute,
      timezone: settings.timezone,
    },
    new Date(),
  );
}

function ensureWeek(weekId: string, capacityHours: number): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO weekly_queue_weeks (week_id, capacity_hours_snapshot, status)
     VALUES (?, ?, 'open') ON CONFLICT(week_id) DO NOTHING`,
  ).run(weekId, capacityHours);

  // Permanent equipment users' sections are always shown on the queue page,
  // so seed their per-user capacity/loading snapshot as soon as the week
  // exists rather than waiting for their first submission that week.
  const permanentUsers = db.prepare("SELECT id FROM equipment_users WHERE is_permanent = 1").all() as {
    id: number;
  }[];
  for (const u of permanentUsers) {
    ensureWeekUserSnapshot(weekId, u.id);
  }
}

/**
 * Lazily creates a (week, equipment user) capacity+loading snapshot if one
 * doesn't exist yet, seeded from that equipment user's current defaults
 * (equipment_users.capacity_hours / loading_cost_minutes); leaves an
 * existing snapshot untouched.
 */
function ensureWeekUserSnapshot(weekId: string, equipmentUserId: number): void {
  const db = getDb();
  const user = db
    .prepare("SELECT capacity_hours, loading_cost_minutes FROM equipment_users WHERE id = ?")
    .get(equipmentUserId) as { capacity_hours: number; loading_cost_minutes: number } | undefined;
  db.prepare(
    `INSERT INTO weekly_queue_week_users (week_id, equipment_user_id, capacity_hours_snapshot, loading_cost_minutes_snapshot)
     VALUES (?, ?, ?, ?) ON CONFLICT(week_id, equipment_user_id) DO NOTHING`,
  ).run(weekId, equipmentUserId, user?.capacity_hours ?? 0, user?.loading_cost_minutes ?? 0);
}

/** Force-overwrites a (week, equipment user) capacity snapshot — used when an admin edits capacity and the change should apply to the still-open week immediately. */
export function setWeekUserSnapshot(weekId: string, equipmentUserId: number, capacityHours: number): void {
  const db = getDb();
  ensureWeekUserSnapshot(weekId, equipmentUserId);
  db.prepare(
    `UPDATE weekly_queue_week_users SET capacity_hours_snapshot = ? WHERE week_id = ? AND equipment_user_id = ?`,
  ).run(capacityHours, weekId, equipmentUserId);
}

/** Force-overwrites a (week, equipment user) loading-time snapshot — used by the chip-layout job editor's "이번 주 로딩 시간" field, which only affects the currently open week, not the equipment user's default. */
export function setWeekUserLoadingSnapshot(weekId: string, equipmentUserId: number, loadingCostMinutes: number): void {
  const db = getDb();
  ensureWeekUserSnapshot(weekId, equipmentUserId);
  db.prepare(
    `UPDATE weekly_queue_week_users SET loading_cost_minutes_snapshot = ? WHERE week_id = ? AND equipment_user_id = ?`,
  ).run(loadingCostMinutes, weekId, equipmentUserId);
}

/** Reads the loading-time snapshot for a (week, equipment user), self-healing (seeding from the default) if it doesn't exist yet. */
export function getWeekUserLoadingCostMinutes(weekId: string, equipmentUserId: number): number {
  const db = getDb();
  ensureWeekUserSnapshot(weekId, equipmentUserId);
  const row = db
    .prepare("SELECT loading_cost_minutes_snapshot FROM weekly_queue_week_users WHERE week_id = ? AND equipment_user_id = ?")
    .get(weekId, equipmentUserId) as { loading_cost_minutes_snapshot: number };
  return row.loading_cost_minutes_snapshot;
}

export function getOpenWeekId(): string | undefined {
  const db = getDb();
  const row = db
    .prepare("SELECT week_id FROM weekly_queue_weeks WHERE status = 'open' ORDER BY week_id DESC LIMIT 1")
    .get() as { week_id: string } | undefined;
  return row?.week_id;
}

/**
 * The week the queue page shows and new submissions land in. Prefers
 * whichever week `weekly_queue_weeks.status = 'open'` marks as current over
 * recomputing from wall-clock time — `getCurrentWeekId` alone doesn't know
 * about cutovers, so a manual "지금 이월 실행" (which jumps the open week
 * forward by 7 days ahead of the real boundary) would otherwise have no
 * visible effect until the wall clock actually caught up. Both the manual
 * and automatic cutover paths update this 'open' row, so following it keeps
 * the displayed week and new-submission routing in sync with whichever
 * cutover actually happened. Falls back to (and creates) the wall-clock week
 * only when no week has ever been opened yet.
 */
export function getActiveWeekId(settings: WeeklySettings = getWeeklySettings()): string {
  const openWeekId = getOpenWeekId();
  if (openWeekId) return openWeekId;

  const weekId = getCurrentWeekId(settings);
  ensureWeek(weekId, settings.weeklyCapacityHours);
  return weekId;
}

/**
 * Reschedules and recolors one equipment user's own pending submissions
 * within a week, using that user's own capacity snapshot — completely
 * independent of every other equipment user's schedule for the same week.
 * Self-heals a missing snapshot (e.g. a non-permanent user's first
 * submission in a week) by falling back to their current capacity_hours.
 */
export function recomputeWeekUser(weekId: string, equipmentUserId: number): void {
  const db = getDb();
  ensureWeekUserSnapshot(weekId, equipmentUserId);
  const snap = db
    .prepare(
      "SELECT capacity_hours_snapshot, loading_cost_minutes_snapshot FROM weekly_queue_week_users WHERE week_id = ? AND equipment_user_id = ?",
    )
    .get(weekId, equipmentUserId) as { capacity_hours_snapshot: number; loading_cost_minutes_snapshot: number };

  const submissions = db
    .prepare(
      `SELECT id, submitted_at, ebeam_current_na, exposure_time_min_s, exposure_time_max_s
       FROM layout_submissions WHERE assigned_week_id = ? AND equipment_user_id = ? AND status = 'pending'`,
    )
    .all(weekId, equipmentUserId) as {
    id: number;
    submitted_at: string;
    ebeam_current_na: number;
    exposure_time_min_s: number;
    exposure_time_max_s: number;
  }[];

  const jobs: Job[] = submissions.map((s) => ({
    id: s.id,
    submittedAt: s.submitted_at,
    currentNa: s.ebeam_current_na,
    minSeconds: s.exposure_time_min_s,
    maxSeconds: s.exposure_time_max_s,
  }));

  const results = scheduleWeek(jobs, snap.capacity_hours_snapshot, snap.loading_cost_minutes_snapshot);
  const update = db.prepare("UPDATE layout_submissions SET color = ?, updated_at = datetime('now') WHERE id = ?");
  const tx = db.transaction(() => {
    for (const r of results) update.run(r.color, r.id);
  });
  tx();
}

/** Recomputes every equipment user active in a week (has a snapshot and/or pending submissions there), each independently via recomputeWeekUser. */
function recomputeWeek(weekId: string): void {
  const db = getDb();
  const weekExists = db.prepare("SELECT 1 FROM weekly_queue_weeks WHERE week_id = ?").get(weekId);
  if (!weekExists) return;

  const userIds = db
    .prepare(
      `SELECT equipment_user_id FROM weekly_queue_week_users WHERE week_id = ?
       UNION
       SELECT equipment_user_id FROM layout_submissions WHERE assigned_week_id = ? AND status = 'pending'`,
    )
    .all(weekId, weekId) as { equipment_user_id: number }[];

  for (const { equipment_user_id } of userIds) {
    recomputeWeekUser(weekId, equipment_user_id);
  }
}

export interface CreateSubmissionInput {
  equipmentUserId: number;
  submittedBy: string;
  gdsFilename: string;
  gdsStoredPath: string;
  svgStoredPath?: string;
  exposureLayers: { layer: number; datatype: number }[];
  layerAreas: Record<string, number>; // "layer:datatype" -> area_um2
  totalAreaUm2: number;
  resistType: string;
  ebeamCurrentNa: number;
  doseUcCm2: number; // the actual dose used for this submission — user-entered (defaults to the resist's reference dose in the UI, but always explicit and required here)
  doseLabel?: string; // custom name for this dose setting; defaults to the resist type
  gridBounds?: GridBounds; // minimal 1000um-aligned e-beam field grid enclosing the selected layers
  requestNotes?: string;
}

export interface CreatedSubmission {
  id: number;
  color: string;
  doseMinUcCm2: number;
  doseMaxUcCm2: number;
  exposureTimeCalculatedS: number;
  exposureTimeMinS: number;
  exposureTimeMaxS: number;
  assignedWeekId: string;
}

export function createSubmission(input: CreateSubmissionInput): CreatedSubmission {
  const db = getDb();

  const equipmentUserRow = db.prepare("SELECT 1 FROM equipment_users WHERE id = ?").get(input.equipmentUserId);
  if (!equipmentUserRow) throw new Error(`unknown equipment user: ${input.equipmentUserId}`);

  const resistRow = db
    .prepare("SELECT 1 FROM resist_reference_doses WHERE resist_type = ?")
    .get(input.resistType);
  if (!resistRow) throw new Error(`unknown resist_type: ${input.resistType}`);

  const currentRow = db
    .prepare("SELECT current_na FROM ebeam_currents WHERE current_na = ?")
    .get(input.ebeamCurrentNa) as { current_na: number } | undefined;
  if (!currentRow) throw new Error(`unknown ebeam current: ${input.ebeamCurrentNa}`);

  if (!input.doseUcCm2 || input.doseUcCm2 <= 0) throw new Error("doseUcCm2 must be a positive number");
  if (!input.exposureLayers.length) throw new Error("select at least one exposure layer");

  const doseUcCm2 = input.doseUcCm2;
  const doseLabel = input.doseLabel?.trim() || input.resistType;

  const settings = getWeeklySettings();
  const estimate = estimateExposureTime({
    areaUm2: input.totalAreaUm2,
    doseUcCm2,
    currentNa: input.ebeamCurrentNa,
    layerCount: input.exposureLayers.length,
    calibrationSeconds: settings.calibrationCostMinutes * 60,
    perLayerSeconds: settings.perLayerCostSeconds,
  });

  const weekId = getActiveWeekId(settings);

  const result = db
    .prepare(
      `INSERT INTO layout_submissions
         (equipment_user_id, submitted_by, gds_filename, gds_stored_path, svg_stored_path, exposure_layers, layer_areas_um2, total_exposure_area_um2,
          resist_type, ebeam_current_na, reference_dose_uc_cm2, dose_label, dose_min_uc_cm2, dose_max_uc_cm2,
          exposure_time_calculated_s, exposure_time_min_s, exposure_time_max_s, status, assigned_week_id,
          grid_left_um, grid_bottom_um, grid_right_um, grid_top_um, request_notes)
       VALUES (@equipment_user_id, @submitted_by, @gds_filename, @gds_stored_path, @svg_stored_path, @exposure_layers, @layer_areas_um2, @total_area,
               @resist_type, @current_na, @reference_dose, @dose_label, @dose_min, @dose_max,
               @time_calculated, @time_min, @time_max, 'pending', @week_id,
               @grid_left, @grid_bottom, @grid_right, @grid_top, @request_notes)`,
    )
    .run({
      equipment_user_id: input.equipmentUserId,
      submitted_by: input.submittedBy,
      gds_filename: input.gdsFilename,
      gds_stored_path: input.gdsStoredPath,
      svg_stored_path: input.svgStoredPath ?? null,
      exposure_layers: JSON.stringify(input.exposureLayers),
      layer_areas_um2: JSON.stringify(input.layerAreas),
      total_area: input.totalAreaUm2,
      resist_type: input.resistType,
      current_na: input.ebeamCurrentNa,
      reference_dose: doseUcCm2,
      dose_label: doseLabel,
      dose_min: estimate.doseMinUcCm2,
      dose_max: estimate.doseMaxUcCm2,
      time_calculated: estimate.timeCalculatedSeconds,
      time_min: estimate.timeMinSeconds,
      time_max: estimate.timeMaxSeconds,
      week_id: weekId,
      grid_left: input.gridBounds?.leftUm ?? null,
      grid_bottom: input.gridBounds?.bottomUm ?? null,
      grid_right: input.gridBounds?.rightUm ?? null,
      grid_top: input.gridBounds?.topUm ?? null,
      request_notes: input.requestNotes?.trim() || null,
    });

  const id = Number(result.lastInsertRowid);
  recomputeWeekUser(weekId, input.equipmentUserId);

  const final = db.prepare("SELECT color FROM layout_submissions WHERE id = ?").get(id) as { color: string };

  return {
    id,
    color: final.color,
    doseMinUcCm2: estimate.doseMinUcCm2,
    doseMaxUcCm2: estimate.doseMaxUcCm2,
    exposureTimeCalculatedS: estimate.timeCalculatedSeconds,
    exposureTimeMinS: estimate.timeMinSeconds,
    exposureTimeMaxS: estimate.timeMaxSeconds,
    assignedWeekId: weekId,
  };
}

interface QueueSubmissionRow {
  id: number;
  submittedBy: string;
  submittedAt: string;
  gdsFilename: string;
  resistType: string;
  doseLabel: string | null;
  doseUcCm2: number;
  ebeamCurrentNa: number;
  exposureTimeCalculatedS: number;
  exposureTimeMinS: number;
  exposureTimeMaxS: number;
  status: string;
  color: string | null;
}

function listWeekSubmissions(weekId: string, equipmentUserId?: number): QueueSubmissionRow[] {
  const db = getDb();
  const rows = (
    equipmentUserId !== undefined
      ? db
          .prepare(
            `SELECT id, submitted_by, submitted_at, gds_filename, resist_type, dose_label, reference_dose_uc_cm2, ebeam_current_na,
                    exposure_time_calculated_s, exposure_time_min_s, exposure_time_max_s, status, color
             FROM layout_submissions WHERE assigned_week_id = ? AND equipment_user_id = ? ORDER BY submitted_at ASC`,
          )
          .all(weekId, equipmentUserId)
      : db
          .prepare(
            `SELECT id, submitted_by, submitted_at, gds_filename, resist_type, dose_label, reference_dose_uc_cm2, ebeam_current_na,
                    exposure_time_calculated_s, exposure_time_min_s, exposure_time_max_s, status, color
             FROM layout_submissions WHERE assigned_week_id = ? ORDER BY submitted_at ASC`,
          )
          .all(weekId)
  ) as {
    id: number;
    submitted_by: string;
    submitted_at: string;
    gds_filename: string;
    resist_type: string;
    dose_label: string | null;
    reference_dose_uc_cm2: number;
    ebeam_current_na: number;
    exposure_time_calculated_s: number;
    exposure_time_min_s: number;
    exposure_time_max_s: number;
    status: string;
    color: string | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    submittedBy: r.submitted_by,
    submittedAt: r.submitted_at,
    gdsFilename: r.gds_filename,
    resistType: r.resist_type,
    doseLabel: r.dose_label,
    doseUcCm2: r.reference_dose_uc_cm2,
    ebeamCurrentNa: r.ebeam_current_na,
    exposureTimeCalculatedS: r.exposure_time_calculated_s,
    exposureTimeMinS: r.exposure_time_min_s,
    exposureTimeMaxS: r.exposure_time_max_s,
    status: r.status,
    color: r.color,
  }));
}

interface WeekLoadSummary {
  totalLoadingMinutes: number;
  totalExposureMinutes: number;
  totalExposureMaxMinutes: number;
  totalExpectedMinutes: number;
  totalExpectedMaxMinutes: number;
}

function getWeekLoadSummaryForUser(weekId: string, equipmentUserId: number): WeekLoadSummary {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT ebeam_current_na, exposure_time_calculated_s
       FROM layout_submissions WHERE assigned_week_id = ? AND equipment_user_id = ? AND status = 'pending'`,
    )
    .all(weekId, equipmentUserId) as { ebeam_current_na: number; exposure_time_calculated_s: number }[];

  const distinctCurrents = new Set(rows.map((r) => r.ebeam_current_na));
  const totalLoadingMinutes = distinctCurrents.size * getWeekUserLoadingCostMinutes(weekId, equipmentUserId);
  const totalExposureMinutes = rows.reduce((sum, r) => sum + r.exposure_time_calculated_s / 60, 0);
  // PEC max band is +20% on the exposure-time estimate (see estimateExposureTime).
  // Loading time is a fixed cost, not subject to PEC, so only the exposure
  // portion is scaled here — the expected-max total below adds loading on
  // top of that scaled exposure figure, not 1.2x'd itself.
  const totalExposureMaxMinutes = totalExposureMinutes * 1.2;

  return {
    totalLoadingMinutes,
    totalExposureMinutes,
    totalExposureMaxMinutes,
    totalExpectedMinutes: totalLoadingMinutes + totalExposureMinutes,
    totalExpectedMaxMinutes: totalLoadingMinutes + totalExposureMaxMinutes,
  };
}

export interface QueueSection extends WeekLoadSummary {
  equipmentUserId: number;
  equipmentUserName: string;
  equipmentUserAlias: string;
  isPermanent: boolean;
  capacityHours: number;
  submissions: QueueSubmissionRow[];
}

/**
 * Queue page sections: one per equipment user. Permanent users always get a
 * section (even with zero submissions this week); non-permanent users only
 * show up once they have a pending submission assigned to this week.
 */
export function getQueueSections(weekId: string): QueueSection[] {
  const db = getDb();
  const users = db
    .prepare(
      `SELECT DISTINCT eu.id, eu.name, eu.alias, eu.is_permanent, eu.display_order
       FROM equipment_users eu
       WHERE eu.is_permanent = 1
          OR eu.id IN (SELECT equipment_user_id FROM layout_submissions WHERE assigned_week_id = ? AND status = 'pending')
       ORDER BY eu.is_permanent DESC, eu.display_order ASC, eu.name ASC`,
    )
    .all(weekId) as { id: number; name: string; alias: string; is_permanent: number; display_order: number }[];

  return users.map((u) => {
    const snap = db
      .prepare("SELECT capacity_hours_snapshot FROM weekly_queue_week_users WHERE week_id = ? AND equipment_user_id = ?")
      .get(weekId, u.id) as { capacity_hours_snapshot: number } | undefined;

    return {
      equipmentUserId: u.id,
      equipmentUserName: u.name,
      equipmentUserAlias: u.alias,
      isPermanent: !!u.is_permanent,
      capacityHours: snap?.capacity_hours_snapshot ?? 0,
      submissions: listWeekSubmissions(weekId, u.id),
      ...getWeekLoadSummaryForUser(weekId, u.id),
    };
  });
}

export function deleteSubmission(id: number): void {
  const db = getDb();
  const before = db.prepare("SELECT * FROM layout_submissions WHERE id = ?").get(id) as
    | { assigned_week_id: string; equipment_user_id: number; gds_stored_path: string; svg_stored_path: string | null }
    | undefined;
  if (!before) throw new Error("submission not found");

  // Chip-layout placement instances reference patterns by a derived string
  // key (see lib/chip-layout.ts), not a foreign key to layout_submissions,
  // so deleting a submission needs no cleanup there — any now-orphaned
  // instance self-prunes the next time that batch's candidates are read.
  db.prepare("DELETE FROM layout_submissions WHERE id = ?").run(id);
  logAudit("delete_submission", "layout_submission", id, before, null);

  const stillReferenced = db
    .prepare("SELECT 1 FROM layout_submissions WHERE gds_stored_path = ?")
    .get(before.gds_stored_path);
  if (!stillReferenced) {
    fs.rmSync(before.gds_stored_path, { force: true });
    if (before.svg_stored_path) fs.rmSync(before.svg_stored_path, { force: true });
  }

  recomputeWeekUser(before.assigned_week_id, before.equipment_user_id);
}

export interface SubmissionDetail extends QueueSubmissionRow {
  requestNotes: string | null;
  exposureLayers: { layer: number; datatype: number }[];
  layerAreasUm2: Record<string, number>;
  totalAreaUm2: number;
  svgStoredPath: string | null;
  gridBounds: GridBounds | null;
  equipmentUserName: string;
  equipmentUserAlias: string;
}

export function getSubmissionDetail(id: number): SubmissionDetail | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT ls.*,
              eu.name AS equipment_user_name,
              eu.alias AS equipment_user_alias
       FROM layout_submissions ls
       JOIN equipment_users eu ON eu.id = ls.equipment_user_id
       WHERE ls.id = ?`,
    )
    .get(id) as
    | {
        id: number;
        submitted_by: string;
        submitted_at: string;
        equipment_user_name: string;
        equipment_user_alias: string;
        gds_filename: string;
        svg_stored_path: string | null;
        resist_type: string;
        dose_label: string | null;
        reference_dose_uc_cm2: number;
        ebeam_current_na: number;
        exposure_time_calculated_s: number;
        exposure_time_min_s: number;
        exposure_time_max_s: number;
        status: string;
        color: string | null;
        exposure_layers: string;
        layer_areas_um2: string;
        total_exposure_area_um2: number;
        request_notes: string | null;
        grid_left_um: number | null;
        grid_bottom_um: number | null;
        grid_right_um: number | null;
        grid_top_um: number | null;
      }
    | undefined;
  if (!row) return null;

  const gridBounds =
    row.grid_left_um !== null && row.grid_bottom_um !== null && row.grid_right_um !== null && row.grid_top_um !== null
      ? {
          leftUm: row.grid_left_um,
          bottomUm: row.grid_bottom_um,
          rightUm: row.grid_right_um,
          topUm: row.grid_top_um,
        }
      : null;

  return {
    id: row.id,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    gdsFilename: row.gds_filename,
    resistType: row.resist_type,
    doseLabel: row.dose_label,
    doseUcCm2: row.reference_dose_uc_cm2,
    ebeamCurrentNa: row.ebeam_current_na,
    exposureTimeCalculatedS: row.exposure_time_calculated_s,
    exposureTimeMinS: row.exposure_time_min_s,
    exposureTimeMaxS: row.exposure_time_max_s,
    status: row.status,
    color: row.color,
    requestNotes: row.request_notes,
    exposureLayers: JSON.parse(row.exposure_layers),
    layerAreasUm2: JSON.parse(row.layer_areas_um2),
    totalAreaUm2: row.total_exposure_area_um2,
    svgStoredPath: row.svg_stored_path,
    gridBounds,
    equipmentUserName: row.equipment_user_name,
    equipmentUserAlias: row.equipment_user_alias,
  };
}

export interface CutoverResult {
  fromWeekId: string;
  toWeekId: string;
  movedCount: number;
}

/**
 * Rolls yellow/orange (unconfirmed) pending submissions from the currently
 * open week into a new week 7 days later, keeping their original
 * submitted_at so FCFS ordering naturally keeps them ahead of that week's
 * genuinely-new submissions. Manually-moved submissions are left alone.
 */
export function runManualCutover(): CutoverResult | null {
  const db = getDb();
  const settings = getWeeklySettings();

  const openWeek = db
    .prepare("SELECT week_id FROM weekly_queue_weeks WHERE status = 'open' ORDER BY week_id DESC LIMIT 1")
    .get() as { week_id: string } | undefined;
  if (!openWeek) return null;

  const fromWeekId = openWeek.week_id;
  const toWeekId = new Date(new Date(fromWeekId + "T00:00:00Z").getTime() + 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  ensureWeek(toWeekId, settings.weeklyCapacityHours);

  const toMove = db
    .prepare(
      `SELECT id FROM layout_submissions
       WHERE assigned_week_id = ? AND status = 'pending' AND manually_moved = 0 AND color IN ('yellow','orange')`,
    )
    .all(fromWeekId) as { id: number }[];

  const move = db.prepare(
    "UPDATE layout_submissions SET assigned_week_id = ?, updated_at = datetime('now') WHERE id = ?",
  );
  const tx = db.transaction(() => {
    for (const row of toMove) move.run(toWeekId, row.id);
    db.prepare("UPDATE weekly_queue_weeks SET status = 'closed' WHERE week_id = ?").run(fromWeekId);
    db.prepare("UPDATE weekly_schedule_settings SET last_cutover_run_at = datetime('now') WHERE id = 1").run();
  });
  tx();

  recomputeWeek(fromWeekId);
  recomputeWeek(toWeekId);

  logAuditCutover(fromWeekId, toWeekId, toMove.length);

  return { fromWeekId, toWeekId, movedCount: toMove.length };
}

function logAuditCutover(fromWeekId: string, toWeekId: string, movedCount: number): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO audit_log (actor, action, entity_type, entity_id, before_json, after_json)
     VALUES ('admin', 'manual_cutover', 'weekly_queue_weeks', NULL, ?, ?)`,
  ).run(JSON.stringify({ fromWeekId }), JSON.stringify({ toWeekId, movedCount }));
}

export function getReferenceData() {
  const db = getDb();
  const resists = db
    .prepare("SELECT resist_type, reference_dose_uc_cm2, is_default FROM resist_reference_doses")
    .all() as {
    resist_type: string;
    reference_dose_uc_cm2: number;
    is_default: number;
  }[];
  const currents = db
    .prepare("SELECT current_na, label, is_default FROM ebeam_currents ORDER BY current_na ASC")
    .all() as { current_na: number; label: string; is_default: number }[];
  const equipmentUsers = db
    .prepare("SELECT id, name, alias FROM equipment_users ORDER BY display_order ASC, id ASC")
    .all() as { id: number; name: string; alias: string }[];
  const settings = getWeeklySettings();
  return {
    resists,
    currents,
    equipmentUsers,
    calibrationCostMinutes: settings.calibrationCostMinutes,
    perLayerCostSeconds: settings.perLayerCostSeconds,
    minDwellNs: settings.minDwellNs,
    dwellMarginRatio: settings.dwellMarginRatio,
  };
}
