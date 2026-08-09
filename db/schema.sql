-- fab-dashboard schema. Applied via: sqlite3 data/fab_dashboard.sqlite < db/schema.sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  vault_folder TEXT NOT NULL,
  status_file_path TEXT,
  status_summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chip_runs (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  label TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  first_seen_date TEXT NOT NULL,
  last_updated_date TEXT NOT NULL,
  notes_summary TEXT,
  source_note_paths TEXT NOT NULL DEFAULT '[]',
  llm_confidence REAL,
  needs_review INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chip_runs_project ON chip_runs(project_id);

CREATE TABLE IF NOT EXISTS pipeline_stage_instances (
  id INTEGER PRIMARY KEY,
  chip_run_id INTEGER NOT NULL REFERENCES chip_runs(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  stage_type TEXT NOT NULL,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  blocked_reason TEXT,
  started_date TEXT,
  completed_date TEXT,
  recipe_entry_id INTEGER REFERENCES recipe_entries(id),
  source_note_paths TEXT NOT NULL DEFAULT '[]',
  llm_confidence REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_stage_instances_chip_run ON pipeline_stage_instances(chip_run_id, sort_order);

-- resolved_path always points at the app's own copy under data/admin-photo-uploads
-- (never directly at a vault file), so maintenance-mode deletion can safely unlink it.
-- source_path is the original vault file a note-indexed photo was copied from (NULL for
-- photos the admin uploaded directly); used to detect vault-side changes/renames on reindex.
-- AUTOINCREMENT is deliberate: ids are never reused, even after a row is deleted.
-- /api/photos/[id] is cached by browsers for 24h, keyed by this id — a reused id
-- would serve a stale cached image for a completely different photo.
CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL UNIQUE,
  resolved_path TEXT NOT NULL,
  source_path TEXT,
  file_mtime TEXT,
  file_size INTEGER
);

CREATE TABLE IF NOT EXISTS photo_index_conflicts (
  id INTEGER PRIMARY KEY,
  filename TEXT NOT NULL,
  candidate_paths TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chip_run_photos (
  id INTEGER PRIMARY KEY,
  chip_run_id INTEGER NOT NULL REFERENCES chip_runs(id) ON DELETE CASCADE,
  stage_instance_id INTEGER REFERENCES pipeline_stage_instances(id) ON DELETE SET NULL,
  photo_id INTEGER NOT NULL REFERENCES photos(id),
  caption TEXT,
  source_note_path TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_crp_chip_run ON chip_run_photos(chip_run_id);

CREATE TABLE IF NOT EXISTS recipe_categories (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  param_schema TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recipe_entries (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES recipe_categories(id),
  recipe_name TEXT NOT NULL,
  chip_run_id INTEGER REFERENCES chip_runs(id),
  entry_date TEXT NOT NULL,
  params TEXT NOT NULL,
  is_standard_condition INTEGER NOT NULL DEFAULT 0,
  source_note_path TEXT NOT NULL,
  source_excerpt TEXT,
  llm_confidence REAL,
  needs_review INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_recipe_entries_cat ON recipe_entries(category_id, recipe_name, entry_date);
CREATE INDEX IF NOT EXISTS idx_recipe_entries_chip_run ON recipe_entries(chip_run_id);

-- Canonical, admin-edited description of a recipe's fixed steps/parameters.
-- Per-entry `params` should only record what varies per chip run, not what's already fixed here.
CREATE TABLE IF NOT EXISTS recipe_definitions (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES recipe_categories(id),
  recipe_name TEXT NOT NULL,
  description TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- 'full': entries carry LLM-extracted per-run params (default).
  -- 'log_only': everything lives in `description`; entries just log entry_date, no params extraction.
  entry_mode TEXT NOT NULL DEFAULT 'full',
  UNIQUE(category_id, recipe_name)
);

-- Admin-managed markers for equipment-level events (e.g. a shutdown for fab
-- construction) that should show up on that recipe's trend chart as a vertical
-- line. Scoped per (category, recipe_name) rather than per-category, since
-- recipes within the same category can run on different physical equipment.
CREATE TABLE IF NOT EXISTS recipe_events (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES recipe_categories(id),
  recipe_name TEXT NOT NULL,
  event_date TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_recipe_events_recipe ON recipe_events(category_id, recipe_name, event_date);

CREATE TABLE IF NOT EXISTS note_ingestion_state (
  note_path TEXT PRIMARY KEY,
  mtime TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  last_processed_at TEXT,
  last_extraction_status TEXT,
  last_extraction_error TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  extraction_model TEXT,
  raw_llm_response TEXT
);

CREATE TABLE IF NOT EXISTS resist_reference_doses (
  resist_type TEXT PRIMARY KEY,
  reference_dose_uc_cm2 REAL NOT NULL,
  notes TEXT,
  reference_thickness_nm REAL,
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ebeam_currents (
  current_na REAL PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS equipment_users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  alias TEXT NOT NULL UNIQUE,
  is_permanent INTEGER NOT NULL DEFAULT 0,
  capacity_hours REAL NOT NULL DEFAULT 0,
  loading_cost_minutes REAL NOT NULL DEFAULT 40,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS layout_submissions (
  id INTEGER PRIMARY KEY,
  equipment_user_id INTEGER NOT NULL REFERENCES equipment_users(id),
  submitted_by TEXT NOT NULL,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  gds_filename TEXT NOT NULL,
  gds_stored_path TEXT NOT NULL,
  svg_stored_path TEXT,
  exposure_layers TEXT NOT NULL,
  layer_areas_um2 TEXT NOT NULL,
  total_exposure_area_um2 REAL NOT NULL,
  grid_left_um REAL,
  grid_bottom_um REAL,
  grid_right_um REAL,
  grid_top_um REAL,
  request_notes TEXT,
  resist_type TEXT NOT NULL,
  ebeam_current_na REAL NOT NULL,
  reference_dose_uc_cm2 REAL NOT NULL,
  dose_label TEXT,
  dose_min_uc_cm2 REAL NOT NULL,
  dose_max_uc_cm2 REAL NOT NULL,
  exposure_time_calculated_s REAL,
  exposure_time_min_s REAL NOT NULL,
  exposure_time_max_s REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_week_id TEXT REFERENCES weekly_queue_weeks(week_id),
  color TEXT,
  manually_moved INTEGER NOT NULL DEFAULT 0,
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_submissions_week ON layout_submissions(assigned_week_id, submitted_at);

CREATE TABLE IF NOT EXISTS weekly_schedule_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  weekly_capacity_hours REAL NOT NULL DEFAULT 2.0,
  cutover_day_of_week INTEGER NOT NULL DEFAULT 3,
  cutover_hour_local INTEGER NOT NULL DEFAULT 8,
  cutover_minute_local INTEGER NOT NULL DEFAULT 0,
  timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
  -- Scheduling itself now uses each equipment_users.loading_cost_minutes;
  -- this column only seeds that value for newly created equipment users.
  loading_cost_minutes REAL NOT NULL DEFAULT 40,
  calibration_cost_minutes REAL NOT NULL DEFAULT 2,
  per_layer_cost_seconds REAL NOT NULL DEFAULT 30,
  min_dwell_ns REAL NOT NULL DEFAULT 8,
  dwell_margin_ratio REAL NOT NULL DEFAULT 0.2,
  last_cutover_run_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS weekly_queue_weeks (
  week_id TEXT PRIMARY KEY,
  capacity_hours_snapshot REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Per-equipment-user capacity snapshot for a given week, frozen when that
-- user's section is first opened for the week (mirrors weekly_queue_weeks'
-- own capacity_hours_snapshot, but split per equipment user instead of
-- lumped together) so FCFS scheduling/coloring runs independently per user.
CREATE TABLE IF NOT EXISTS weekly_queue_week_users (
  week_id TEXT NOT NULL REFERENCES weekly_queue_weeks(week_id),
  equipment_user_id INTEGER NOT NULL REFERENCES equipment_users(id),
  capacity_hours_snapshot REAL NOT NULL,
  -- Loading time for this specific week only — editable from the chip-layout
  -- editor without touching equipment_users.loading_cost_minutes (that
  -- column is just the default used to seed brand-new weeks/users).
  loading_cost_minutes_snapshot REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (week_id, equipment_user_id)
);

-- e-beam mock chip-placement jobs: one equipment user can keep several named
-- "jobs" (e.g. Job1, Job2), each a full mock layout of one cassette's windows.
-- week_id scopes a batch to the weekly queue's week (see apps/web/lib/queue.ts
-- getActiveWeekId) — batches never carry over into a new week on cutover;
-- they just accumulate here for history while the editor only ever lists the
-- current week's rows, so a fresh week always starts from an empty list.
CREATE TABLE IF NOT EXISTS chip_layout_jobs (
  id INTEGER PRIMARY KEY,
  equipment_user_id INTEGER NOT NULL REFERENCES equipment_users(id),
  week_id TEXT NOT NULL REFERENCES weekly_queue_weeks(week_id),
  name TEXT NOT NULL,
  cassette_type TEXT NOT NULL DEFAULT 'piece2' CHECK (cassette_type IN ('piece1', 'piece2')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chip_layout_jobs_equipment_user ON chip_layout_jobs(equipment_user_id);
CREATE INDEX IF NOT EXISTS idx_chip_layout_jobs_week ON chip_layout_jobs(equipment_user_id, week_id);

-- A physical chip/die mocked into one cassette window, purely a visual
-- background block behind pattern placements — its height always fills the
-- window's full height (so there's no meaningful center_y), only width and
-- center_x are user-set.
CREATE TABLE IF NOT EXISTS chip_layout_chips (
  id INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES chip_layout_jobs(id),
  name TEXT NOT NULL,
  window_key TEXT NOT NULL CHECK (window_key IN ('A', 'B', 'D')),
  width_um REAL NOT NULL,
  center_x_um REAL NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chip_layout_chips_job ON chip_layout_chips(job_id);

-- An e-beam exposure job within a batch: a (current, dose, scan step)
-- recipe that one or more placement instances (below) get exposed under.
-- Name is system-assigned (Job1, Job2, ...) and not user-editable.
-- window_key lives here, not on chip_layout_placement_instances: a job is
-- compiled and run as a single write to one physical cassette window, so
-- every pattern placed under it necessarily shares that job's window.
CREATE TABLE IF NOT EXISTS chip_layout_exposure_jobs (
  id INTEGER PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES chip_layout_jobs(id),
  name TEXT NOT NULL,
  current_na REAL NOT NULL,
  dose_uc_cm2 REAL NOT NULL,
  scan_step INTEGER NOT NULL,
  window_key TEXT NOT NULL DEFAULT 'B' CHECK (window_key IN ('A', 'B', 'D')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chip_layout_exposure_jobs_batch ON chip_layout_exposure_jobs(batch_id);

-- User-reorderable a/b/c/... slot letter per pattern within a batch — purely
-- a display label, kept contiguous/unique per batch entirely in application
-- code (lib/chip-layout.ts's ensurePatternSlotsForBatch / assignPatternSlot),
-- not via a DB constraint. Placement instances reference patterns by
-- pattern_key, not slot, so reassigning a slot here never touches them —
-- their displayed slot letter is just looked up fresh against this table.
CREATE TABLE IF NOT EXISTS chip_layout_pattern_slots (
  id INTEGER PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES chip_layout_jobs(id),
  pattern_key TEXT NOT NULL,
  slot_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (batch_id, pattern_key)
);
CREATE INDEX IF NOT EXISTS idx_chip_layout_pattern_slots_batch ON chip_layout_pattern_slots(batch_id);

-- One placement of one pattern (identified by pattern_key, a deterministic
-- string derived fresh from this week's queue each read — see
-- lib/chip-layout.ts's listPatternCandidates — not a stored foreign key)
-- within one exposure job. Deliberately no uniqueness constraint on
-- pattern_key: the same pattern can be placed more than once, even within
-- the same exposure job.
CREATE TABLE IF NOT EXISTS chip_layout_placement_instances (
  id INTEGER PRIMARY KEY,
  exposure_job_id INTEGER NOT NULL REFERENCES chip_layout_exposure_jobs(id),
  pattern_key TEXT NOT NULL,
  center_x_um REAL NOT NULL DEFAULT 0,
  center_y_um REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chip_layout_placement_instances_job ON chip_layout_placement_instances(exposure_job_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed data
INSERT OR IGNORE INTO weekly_schedule_settings (id, weekly_capacity_hours, cutover_day_of_week, cutover_hour_local, cutover_minute_local, timezone, loading_cost_minutes, calibration_cost_minutes, per_layer_cost_seconds, min_dwell_ns, dwell_margin_ratio)
VALUES (1, 2.0, 3, 8, 0, 'Asia/Seoul', 40, 2, 30, 8, 0.2);

INSERT OR IGNORE INTO recipe_categories (slug, name, param_schema, sort_order) VALUES
  ('cleaning_coating', '세정 및 레지스트 코팅(Cleaning & Resist Coating)', '{"method":"string","time_s":"number","resist_type":"string","resist_thickness_nm":"number","spin_rpm":"number","soft_bake_temp_c":"number","soft_bake_time_min":"number"}', 1),
  ('lithography', '전자빔리소그래피(E-beam lithography)', '{"dose_uc_cm2":"number","current_na":"number","aperture":"string","voltage_kv":"number"}', 2),
  ('photolithography', '포토리소그래피(Photolithography)', '{"resist_type":"string","exposure_time_s":"number","mask_type":"string","developer":"string"}', 3),
  ('development', '현상(Development)', '{"developer":"string","time_s":"number","temperature_c":"number"}', 4),
  ('etching', '식각(Etching)', '{"resist_type":"string","resist_thickness_nm":"number","etch_time_s":"number","etch_depth_nm":"number","selectivity":"number","pattern_tone":"enum:positive,negative","pressure_mtorr":"number","rf_power_w":"number","icp_power_w":"number","gas":"string"}', 5),
  ('deposition', '증착(Deposition)', '{"material":"string","thickness_nm":"number","rate_nm_per_min":"number","temperature_c":"number","pressure":"string"}', 6),
  ('other', '기타(Other)', '{}', 7);

INSERT OR IGNORE INTO resist_reference_doses (resist_type, reference_dose_uc_cm2, notes, reference_thickness_nm, is_default) VALUES
  ('ZEP520A', 240, 'KANC JEOL JBX-8100S 100kV 표준 조건 기준 (관리자 조정 가능)', 300, 1);

INSERT OR IGNORE INTO ebeam_currents (current_na, label, sort_order, is_default) VALUES
  (2, '2nA (KANC 표준)', 1, 1);

-- capacity_hours for permanent users is the even split of weekly_capacity_hours
-- above (2.0h / 2 = 1.0h each); non-permanent users default to 0 until an
-- admin assigns them capacity. loading_cost_minutes starts at the same value
-- as weekly_schedule_settings.loading_cost_minutes for every user, but is
-- independently editable per equipment user from then on.
-- Example bootstrap rows for a fresh install — replace with your own lab's
-- equipment users and projects after running scripts/init-db.sh.
INSERT OR IGNORE INTO equipment_users (name, alias, is_permanent, capacity_hours, loading_cost_minutes, display_order) VALUES
  ('연구원1', 'user1', 1, 1.0, 40, 1),
  ('연구원2', 'user2', 1, 1.0, 40, 2),
  ('연구원3', 'user3', 0, 0, 40, 3),
  ('연구원4', 'user4', 0, 0, 40, 4);

INSERT OR IGNORE INTO projects (slug, name, vault_folder, status_file_path) VALUES
  ('project-a', 'Project A', '1_Project A', 'project/1_Project A/현황 정리.md'),
  ('project-b', 'Project B', '2_Project B', 'project/2_Project B/현황 정리.md'),
  ('project-c', 'Project C', '3_Project C', 'project/3_Project C/현황 정리.md'),
  ('project-d', 'Project D', '4_Project D', 'project/4_Project D/현황 정리.md');
