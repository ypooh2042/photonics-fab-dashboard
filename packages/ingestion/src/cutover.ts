import { getDb } from "./db.js";
import { currentWeekId, scheduleWeek, type Job } from "@fab-dashboard/scheduling";

interface Settings {
  weeklyCapacityHours: number;
  cutoverDayOfWeek: number;
  cutoverHour: number;
  cutoverMinute: number;
  timezone: string;
  loadingCostMinutes: number;
  lastCutoverRunAt: string | null;
}

function getSettings(): Settings {
  const db = getDb();
  const row = db.prepare("SELECT * FROM weekly_schedule_settings WHERE id = 1").get() as {
    weekly_capacity_hours: number;
    cutover_day_of_week: number;
    cutover_hour_local: number;
    cutover_minute_local: number;
    timezone: string;
    loading_cost_minutes: number;
    last_cutover_run_at: string | null;
  };
  return {
    weeklyCapacityHours: row.weekly_capacity_hours,
    cutoverDayOfWeek: row.cutover_day_of_week,
    cutoverHour: row.cutover_hour_local,
    cutoverMinute: row.cutover_minute_local,
    timezone: row.timezone,
    loadingCostMinutes: row.loading_cost_minutes,
    lastCutoverRunAt: row.last_cutover_run_at,
  };
}

function boundary(settings: Settings) {
  return {
    cutoverDayOfWeek: settings.cutoverDayOfWeek,
    cutoverHour: settings.cutoverHour,
    cutoverMinute: settings.cutoverMinute,
    timezone: settings.timezone,
  };
}

/**
 * Lazily creates a (week, equipment user) capacity+loading snapshot if one
 * doesn't exist yet, seeded from that equipment user's current defaults;
 * leaves an existing snapshot untouched (mirrors apps/web/lib/queue.ts's
 * ensureWeekUserSnapshot — this package has its own duplicate scheduling
 * copy for the cron-driven automatic cutover path).
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

function ensureWeek(weekId: string, capacityHours: number): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO weekly_queue_weeks (week_id, capacity_hours_snapshot, status)
     VALUES (?, ?, 'open') ON CONFLICT(week_id) DO NOTHING`,
  ).run(weekId, capacityHours);

  // Permanent equipment users' sections are always shown, so seed their
  // per-user snapshot as soon as the week exists.
  const permanentUsers = db.prepare("SELECT id FROM equipment_users WHERE is_permanent = 1").all() as {
    id: number;
  }[];
  for (const u of permanentUsers) {
    ensureWeekUserSnapshot(weekId, u.id);
  }
}

/** Reschedules/recolors one equipment user's pending submissions in a week, using that user's own capacity+loading snapshot — independent of every other equipment user. */
function recomputeWeekUser(weekId: string, equipmentUserId: number): void {
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

/** Recomputes every equipment user active in a week, each independently via recomputeWeekUser. */
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

export interface CutoverCheckResult {
  ran: boolean;
  fromWeekId?: string;
  toWeekId?: string;
  movedCount?: number;
}

/**
 * Hourly-invoked check: has the configured cutover boundary (e.g. every
 * Wednesday 08:00 KST) been crossed since the last time we checked? Uses
 * "which logical week are we in" rather than exact-timestamp matching, so a
 * missed or delayed cron run still fires correctly on the next check.
 */
export function checkAndRunCutover(now: Date = new Date()): CutoverCheckResult {
  const db = getDb();
  const settings = getSettings();
  const b = boundary(settings);

  const nowWeekId = currentWeekId(b, now);
  const lastRunWeekId = settings.lastCutoverRunAt ? currentWeekId(b, new Date(settings.lastCutoverRunAt)) : null;

  if (lastRunWeekId === nowWeekId) {
    return { ran: false };
  }

  const openWeek = db
    .prepare("SELECT week_id FROM weekly_queue_weeks WHERE status = 'open' ORDER BY week_id DESC LIMIT 1")
    .get() as { week_id: string } | undefined;

  if (!openWeek || openWeek.week_id === nowWeekId) {
    // Nothing to roll over yet (no submissions ever, or already on the current week).
    db.prepare("UPDATE weekly_schedule_settings SET last_cutover_run_at = datetime('now') WHERE id = 1").run();
    return { ran: false };
  }

  const fromWeekId = openWeek.week_id;
  const toWeekId = nowWeekId;

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
    db.prepare(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, before_json, after_json)
       VALUES ('system:cutover', 'auto_cutover', 'weekly_queue_weeks', NULL, ?, ?)`,
    ).run(JSON.stringify({ fromWeekId }), JSON.stringify({ toWeekId, movedCount: toMove.length }));
  });
  tx();

  recomputeWeek(fromWeekId);
  recomputeWeek(toWeekId);

  return { ran: true, fromWeekId, toWeekId, movedCount: toMove.length };
}
