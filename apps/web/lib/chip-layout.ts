import fs from "node:fs";
import path from "node:path";
import { getDb } from "./db";
import { logAudit } from "./audit";
import { getActiveWeekId, getWeeklySettings } from "./queue";
import { estimateExposureTime } from "@fab-dashboard/scheduling/fcfs";
import { computeMinPixelResolution } from "@fab-dashboard/scheduling/resolution";
import { chipFillColor } from "./chip-colors";

export type CassetteType = "piece1" | "piece2";
export type WindowKey = "A" | "B" | "D";

interface WindowDef {
  key: WindowKey;
  widthUm: number;
  heightUm: number;
}

const MM = 1000;

/** Fixed cassette geometry — every window rect is center-origin (0,0), width x height in µm. */
const CASSETTE_WINDOWS: Record<CassetteType, WindowDef[]> = {
  piece1: [
    { key: "A", widthUm: 50 * MM, heightUm: 8 * MM },
    { key: "B", widthUm: 50 * MM, heightUm: 18 * MM },
  ],
  piece2: [
    { key: "A", widthUm: 50 * MM, heightUm: 28 * MM },
    { key: "B", widthUm: 50 * MM, heightUm: 18 * MM },
    { key: "D", widthUm: 50 * MM, heightUm: 18 * MM },
  ],
};

function getWindowsForCassette(cassetteType: CassetteType): WindowDef[] {
  return CASSETTE_WINDOWS[cassetteType];
}

/** piece2's default is window B; piece1 has no specific default, so just its first window — mirrors the frontend's defaultWindowKey. */
function defaultWindowKeyForCassette(cassetteType: CassetteType): WindowKey {
  if (cassetteType === "piece2") return "B";
  return CASSETTE_WINDOWS[cassetteType][0].key;
}

const DEFAULT_CHIP_WIDTH_UM = 22 * MM;

function nextDefaultName(existingNames: string[], prefix: string): string {
  const re = new RegExp(`^${prefix}(\\d+)$`, "i");
  let max = 0;
  for (const n of existingNames) {
    const m = n.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${max + 1}`;
}

function validateWindowKey(cassetteType: CassetteType, windowKey: WindowKey): void {
  const allowed = new Set(getWindowsForCassette(cassetteType).map((w) => w.key));
  if (!allowed.has(windowKey)) throw new Error("현재 카세트 타입에서 사용할 수 없는 window입니다");
}

// ---------------------------------------------------------------------------
// Batch (chip_layout_jobs) — the top-level cassette-loading container.
// ---------------------------------------------------------------------------

export interface ChipLayoutJob {
  id: number;
  equipmentUserId: number;
  weekId: string;
  name: string;
  cassetteType: CassetteType;
  displayOrder: number;
}

interface JobRow {
  id: number;
  equipment_user_id: number;
  week_id: string;
  name: string;
  cassette_type: CassetteType;
  display_order: number;
}

function mapJobRow(r: JobRow): ChipLayoutJob {
  return {
    id: r.id,
    equipmentUserId: r.equipment_user_id,
    weekId: r.week_id,
    name: r.name,
    cassetteType: r.cassette_type,
    displayOrder: r.display_order,
  };
}

export function getJob(id: number): ChipLayoutJob | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM chip_layout_jobs WHERE id = ?").get(id) as JobRow | undefined;
  return row ? mapJobRow(row) : null;
}

function getJobOrThrow(id: number): ChipLayoutJob {
  const job = getJob(id);
  if (!job) throw new Error("존재하지 않는 job입니다");
  return job;
}

/**
 * Lists an equipment user's batches for one queue week — the active week by
 * default, auto-creating a "Batch1" the first time this week (so the
 * chip-layout page always has something to show, and a new week always
 * starts empty regardless of past weeks' batches). An explicit past `weekId`
 * is read-only: an empty result just means that week had no batches, and
 * must never auto-create one (that would fabricate history).
 */
export function listJobs(equipmentUserId: number, weekId?: string): ChipLayoutJob[] {
  const db = getDb();
  const activeWeekId = getActiveWeekId();
  const targetWeekId = weekId ?? activeWeekId;
  const rows = db
    .prepare(
      "SELECT * FROM chip_layout_jobs WHERE equipment_user_id = ? AND week_id = ? ORDER BY display_order ASC, id ASC",
    )
    .all(equipmentUserId, targetWeekId) as JobRow[];
  if (rows.length === 0) {
    if (targetWeekId !== activeWeekId) return [];
    createJob(equipmentUserId, "Batch1");
    return listJobs(equipmentUserId);
  }
  return rows.map(mapJobRow);
}

export function createJob(equipmentUserId: number, name?: string, cassetteType: CassetteType = "piece2"): ChipLayoutJob {
  const db = getDb();
  const weekId = getActiveWeekId();
  const existing = db
    .prepare("SELECT name FROM chip_layout_jobs WHERE equipment_user_id = ? AND week_id = ?")
    .all(equipmentUserId, weekId) as { name: string }[];
  const finalName = name?.trim() || nextDefaultName(existing.map((e) => e.name), "Batch");
  const maxOrder = db
    .prepare("SELECT COALESCE(MAX(display_order), 0) AS m FROM chip_layout_jobs WHERE equipment_user_id = ? AND week_id = ?")
    .get(equipmentUserId, weekId) as { m: number };

  const result = db
    .prepare(
      `INSERT INTO chip_layout_jobs (equipment_user_id, week_id, name, cassette_type, display_order)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(equipmentUserId, weekId, finalName, cassetteType, maxOrder.m + 1);
  const id = Number(result.lastInsertRowid);
  logAudit("create_chip_layout_job", "chip_layout_jobs", id, null, { equipmentUserId, weekId, name: finalName, cassetteType });
  return getJobOrThrow(id);
}

export interface JobUpdateInput {
  name?: string;
  cassetteType?: CassetteType;
}

/** Renames and/or switches cassette type. Blocks the cassette-type switch if any chip/placement in this batch sits in a window the new type doesn't have. */
export function updateJob(id: number, input: JobUpdateInput): ChipLayoutJob {
  const db = getDb();
  const before = getJobOrThrow(id);
  const name = input.name !== undefined ? input.name.trim() || before.name : before.name;
  const cassetteType = input.cassetteType ?? before.cassetteType;

  if (cassetteType !== before.cassetteType) {
    const allowed = new Set(getWindowsForCassette(cassetteType).map((w) => w.key));
    const chipWindows = db.prepare("SELECT window_key FROM chip_layout_chips WHERE job_id = ?").all(id) as {
      window_key: WindowKey;
    }[];
    const exposureJobWindows = db
      .prepare("SELECT window_key FROM chip_layout_exposure_jobs WHERE batch_id = ?")
      .all(id) as { window_key: WindowKey }[];
    const blocked = [...chipWindows, ...exposureJobWindows].some((r) => !allowed.has(r.window_key));
    if (blocked) {
      throw new Error(
        "현재 카세트 타입에 없는 window에 이미 배치된 칩/패턴이 있어 변경할 수 없습니다. 먼저 해당 배치를 옮기거나 삭제해주세요.",
      );
    }
  }

  db.prepare("UPDATE chip_layout_jobs SET name = ?, cassette_type = ?, updated_at = datetime('now') WHERE id = ?").run(
    name,
    cassetteType,
    id,
  );
  const after = getJobOrThrow(id);
  logAudit("update_chip_layout_job", "chip_layout_jobs", id, before, after);
  return after;
}

export function deleteJob(id: number): void {
  const db = getDb();
  const before = getJob(id);
  if (!before) return;

  const tx = db.transaction(() => {
    const exposureJobIds = db.prepare("SELECT id FROM chip_layout_exposure_jobs WHERE batch_id = ?").all(id) as {
      id: number;
    }[];
    for (const ej of exposureJobIds) {
      db.prepare("DELETE FROM chip_layout_placement_instances WHERE exposure_job_id = ?").run(ej.id);
    }
    db.prepare("DELETE FROM chip_layout_exposure_jobs WHERE batch_id = ?").run(id);
    db.prepare("DELETE FROM chip_layout_pattern_slots WHERE batch_id = ?").run(id);
    db.prepare("DELETE FROM chip_layout_chips WHERE job_id = ?").run(id);
    db.prepare("DELETE FROM chip_layout_jobs WHERE id = ?").run(id);
  });
  tx();
  logAudit("delete_chip_layout_job", "chip_layout_jobs", id, before, null);
  for (const key of ALL_WINDOW_KEYS) fs.rmSync(getJobPreviewSvgPath(id, key), { force: true });
}

// ---------------------------------------------------------------------------
// Chips — visual background blocks in a window, unchanged from before.
// ---------------------------------------------------------------------------

export interface ChipLayoutChip {
  id: number;
  jobId: number;
  name: string;
  windowKey: WindowKey;
  widthUm: number;
  centerXUm: number;
  displayOrder: number;
}

interface ChipRow {
  id: number;
  job_id: number;
  name: string;
  window_key: WindowKey;
  width_um: number;
  center_x_um: number;
  display_order: number;
}

function mapChipRow(r: ChipRow): ChipLayoutChip {
  return {
    id: r.id,
    jobId: r.job_id,
    name: r.name,
    windowKey: r.window_key,
    widthUm: r.width_um,
    centerXUm: r.center_x_um,
    displayOrder: r.display_order,
  };
}

function getChipOrThrow(id: number): ChipLayoutChip {
  const db = getDb();
  const row = db.prepare("SELECT * FROM chip_layout_chips WHERE id = ?").get(id) as ChipRow | undefined;
  if (!row) throw new Error("존재하지 않는 칩입니다");
  return mapChipRow(row);
}

export function listChips(jobId: number): ChipLayoutChip[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM chip_layout_chips WHERE job_id = ? ORDER BY display_order ASC, id ASC")
    .all(jobId) as ChipRow[];
  return rows.map(mapChipRow);
}

export interface ChipCreateInput {
  name?: string;
  windowKey: WindowKey;
  widthUm?: number;
}

/** New chips always start centered at (0,0) in the chosen window, per the mock-placement spec. */
export function createChip(jobId: number, input: ChipCreateInput): ChipLayoutChip {
  const db = getDb();
  const job = getJobOrThrow(jobId);
  validateWindowKey(job.cassetteType, input.windowKey);
  const widthUm = input.widthUm && input.widthUm > 0 ? input.widthUm : DEFAULT_CHIP_WIDTH_UM;

  const existing = db.prepare("SELECT name FROM chip_layout_chips WHERE job_id = ?").all(jobId) as { name: string }[];
  const name = input.name?.trim() || nextDefaultName(existing.map((e) => e.name), "chip");
  const maxOrder = db
    .prepare("SELECT COALESCE(MAX(display_order), 0) AS m FROM chip_layout_chips WHERE job_id = ?")
    .get(jobId) as { m: number };

  const result = db
    .prepare(
      `INSERT INTO chip_layout_chips (job_id, name, window_key, width_um, center_x_um, display_order)
       VALUES (?, ?, ?, ?, 0, ?)`,
    )
    .run(jobId, name, input.windowKey, widthUm, maxOrder.m + 1);
  const id = Number(result.lastInsertRowid);
  logAudit("create_chip_layout_chip", "chip_layout_chips", id, null, {
    jobId,
    name,
    windowKey: input.windowKey,
    widthUm,
  });
  return getChipOrThrow(id);
}

export interface ChipUpdateInput {
  name?: string;
  windowKey?: WindowKey;
  widthUm?: number;
  centerXUm?: number;
}

export function updateChip(id: number, input: ChipUpdateInput): ChipLayoutChip {
  const db = getDb();
  const before = getChipOrThrow(id);
  const job = getJobOrThrow(before.jobId);

  const name = input.name !== undefined ? input.name.trim() || before.name : before.name;
  const windowKey = input.windowKey ?? before.windowKey;
  if (input.windowKey !== undefined) validateWindowKey(job.cassetteType, windowKey);
  const widthUm = input.widthUm !== undefined && input.widthUm > 0 ? input.widthUm : before.widthUm;
  const centerXUm = input.centerXUm !== undefined ? input.centerXUm : before.centerXUm;

  db.prepare(
    `UPDATE chip_layout_chips SET name = ?, window_key = ?, width_um = ?, center_x_um = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(name, windowKey, widthUm, centerXUm, id);
  const after = getChipOrThrow(id);
  logAudit("update_chip_layout_chip", "chip_layout_chips", id, before, after);
  return after;
}

export function deleteChip(id: number): void {
  const db = getDb();
  const before = getChipOrThrow(id);
  db.prepare("DELETE FROM chip_layout_chips WHERE id = ?").run(id);
  logAudit("delete_chip_layout_chip", "chip_layout_chips", id, before, null);
}

// ---------------------------------------------------------------------------
// Pattern candidates — a read-only catalog derived fresh from this week's
// queue each time, deduped by base layout name (same name, different
// current/dose submissions collapse into one; the union of their exposure
// layers is what's offered). Never stored — patternKey is a deterministic
// string, not a database id, so nothing here can ever go stale/dangle the
// way the old per-submission slot table could.
// ---------------------------------------------------------------------------

function slotLetterFor(index: number): string {
  return String.fromCharCode(97 + index);
}

interface PatternCandidateInternal {
  patternKey: string;
  slotIndex: number;
  slotLetter: string;
  candidateLabel: string;
  sizeXUm: number;
  sizeYUm: number;
  areaUm2: number;
  svgStoredPath: string | null;
  gridLeftUm: number;
  gridBottomUm: number;
  gridRightUm: number;
  gridTopUm: number;
  layer: number;
  datatype: number;
}

export interface PatternCandidate {
  patternKey: string;
  slotIndex: number;
  slotLetter: string;
  candidateLabel: string;
  sizeXUm: number;
  sizeYUm: number;
}

interface SubmissionForCandidates {
  submittedAt: string;
  layers: { layer: number; datatype: number }[];
  layerAreas: Record<string, number>;
  svgStoredPath: string | null;
  gridLeftUm: number;
  gridBottomUm: number;
  gridRightUm: number;
  gridTopUm: number;
}

/** Deduped/unioned candidates in natural queue order (no slot letters yet — see ensurePatternSlotsForBatch for the user-reorderable a/b/c/... layer). */
function computeRawCandidates(batchId: number): Omit<PatternCandidateInternal, "slotIndex" | "slotLetter">[] {
  const db = getDb();
  const batch = getJobOrThrow(batchId);
  // The batch's own week, not whatever week happens to be globally active —
  // otherwise a past week's batch would show the *current* week's candidates.
  const weekId = batch.weekId;

  // Both 'pending' and 'completed' submissions count as valid pattern
  // sources — marking a submission exposed shouldn't make its GDS patterns
  // vanish from candidate computation, only take it out of the scheduling
  // backlog (see recomputeWeekUser).
  const submissions = db
    .prepare(
      `SELECT gds_filename, submitted_at, exposure_layers, layer_areas_um2, svg_stored_path,
              grid_left_um, grid_bottom_um, grid_right_um, grid_top_um
       FROM layout_submissions WHERE equipment_user_id = ? AND assigned_week_id = ? AND status IN ('pending', 'completed')
       ORDER BY submitted_at ASC, id ASC`,
    )
    .all(batch.equipmentUserId, weekId) as {
    gds_filename: string;
    submitted_at: string;
    exposure_layers: string;
    layer_areas_um2: string;
    svg_stored_path: string | null;
    grid_left_um: number | null;
    grid_bottom_um: number | null;
    grid_right_um: number | null;
    grid_top_um: number | null;
  }[];

  // Group by base filename (minus .gds) — same-named layouts with different
  // current/dose collapse into a single group; layers are unioned below.
  const groups = new Map<string, SubmissionForCandidates[]>();
  for (const s of submissions) {
    const baseName = s.gds_filename.replace(/\.gds$/i, "");
    const member: SubmissionForCandidates = {
      submittedAt: s.submitted_at,
      layers: JSON.parse(s.exposure_layers) as { layer: number; datatype: number }[],
      layerAreas: JSON.parse(s.layer_areas_um2) as Record<string, number>,
      svgStoredPath: s.svg_stored_path,
      gridLeftUm: s.grid_left_um ?? 0,
      gridBottomUm: s.grid_bottom_um ?? 0,
      gridRightUm: s.grid_right_um ?? 0,
      gridTopUm: s.grid_top_um ?? 0,
    };
    if (!groups.has(baseName)) groups.set(baseName, []);
    groups.get(baseName)!.push(member);
  }

  const candidates: Omit<PatternCandidateInternal, "slotIndex" | "slotLetter">[] = [];
  for (const [baseName, members] of groups) {
    const layerToMembers = new Map<string, SubmissionForCandidates[]>();
    for (const m of members) {
      for (const l of m.layers) {
        const key = `${l.layer}:${l.datatype}`;
        if (!layerToMembers.has(key)) layerToMembers.set(key, []);
        layerToMembers.get(key)!.push(m);
      }
    }

    const layerKeys = [...layerToMembers.keys()].sort((a, b) => {
      const [al, ad] = a.split(":").map(Number);
      const [bl, bd] = b.split(":").map(Number);
      return al - bl || ad - bd;
    });
    const layerNumberCounts = new Map<number, number>();
    for (const key of layerKeys) {
      const layer = Number(key.split(":")[0]);
      layerNumberCounts.set(layer, (layerNumberCounts.get(layer) ?? 0) + 1);
    }

    for (const layerKey of layerKeys) {
      const [layer, datatype] = layerKey.split(":").map(Number);
      const membersWithLayer = layerToMembers.get(layerKey)!;
      // Prefer the most recently submitted member that actually contains this layer.
      const source = membersWithLayer.reduce((best, m) => (m.submittedAt > best.submittedAt ? m : best));
      const dupSuffix = (layerNumberCounts.get(layer) ?? 0) > 1 ? `.${datatype}` : "";

      candidates.push({
        patternKey: `${baseName}::L${layer}D${datatype}`,
        candidateLabel: `${baseName}_layer${layer}${dupSuffix}`,
        sizeXUm: source.gridRightUm - source.gridLeftUm,
        sizeYUm: source.gridTopUm - source.gridBottomUm,
        areaUm2: source.layerAreas[layerKey] ?? 0,
        svgStoredPath: source.svgStoredPath,
        gridLeftUm: source.gridLeftUm,
        gridBottomUm: source.gridBottomUm,
        gridRightUm: source.gridRightUm,
        gridTopUm: source.gridTopUm,
        layer,
        datatype,
      });
    }
  }

  return candidates;
}

/**
 * Keeps chip_layout_pattern_slots in sync with this batch's live candidate
 * set: appends a fresh row for any new candidate at the end in queue order,
 * and drops rows for candidates no longer in the queue. Remaining rows are
 * renumbered to a contiguous 0..N-1 slot_index, preserving their relative
 * (and thus any custom-reordered) order, so a/b/c/... never has gaps.
 */
function ensurePatternSlotsForBatch(batchId: number, candidates: { patternKey: string }[]): void {
  const db = getDb();
  const existing = db
    .prepare("SELECT id, pattern_key, slot_index FROM chip_layout_pattern_slots WHERE batch_id = ? ORDER BY slot_index ASC")
    .all(batchId) as { id: number; pattern_key: string; slot_index: number }[];

  const candidateKeySet = new Set(candidates.map((c) => c.patternKey));
  const existingKeySet = new Set(existing.map((e) => e.pattern_key));

  const toDelete = existing.filter((e) => !candidateKeySet.has(e.pattern_key));
  const kept = existing.filter((e) => candidateKeySet.has(e.pattern_key));
  const fresh = candidates.filter((c) => !existingKeySet.has(c.patternKey));

  const alreadyContiguous = kept.every((e, i) => e.slot_index === i);
  if (toDelete.length === 0 && fresh.length === 0 && alreadyContiguous) return;

  const tx = db.transaction(() => {
    for (const e of toDelete) db.prepare("DELETE FROM chip_layout_pattern_slots WHERE id = ?").run(e.id);
    let idx = 0;
    for (const e of kept) {
      db.prepare("UPDATE chip_layout_pattern_slots SET slot_index = ? WHERE id = ?").run(idx, e.id);
      idx++;
    }
    for (const c of fresh) {
      db.prepare("INSERT INTO chip_layout_pattern_slots (batch_id, pattern_key, slot_index) VALUES (?, ?, ?)").run(
        batchId,
        c.patternKey,
        idx,
      );
      idx++;
    }
  });
  tx();
}

/**
 * Reorders this batch's pattern list to match `orderedPatternKeys` — slot
 * letters are purely derived from array position (see slotLetterFor), so
 * reordering is just rewriting each pattern's slot_index to its new index.
 * `orderedPatternKeys` must be a permutation of the batch's current pattern
 * keys (same set, same length) — the caller (the drag-to-reorder UI) always
 * derives it from a freshly loaded candidate list, so a mismatch means the
 * list changed underneath the user and they should reload before retrying.
 */
export function reorderPatternSlots(batchId: number, orderedPatternKeys: string[]): void {
  const db = getDb();
  getJobOrThrow(batchId);
  ensurePatternSlotsForBatch(batchId, computeRawCandidates(batchId));

  const existing = db
    .prepare("SELECT id, pattern_key FROM chip_layout_pattern_slots WHERE batch_id = ?")
    .all(batchId) as { id: number; pattern_key: string }[];
  const idByKey = new Map(existing.map((e) => [e.pattern_key, e.id]));

  const isSamePatternSet =
    orderedPatternKeys.length === existing.length && orderedPatternKeys.every((key) => idByKey.has(key));
  if (!isSamePatternSet) {
    throw new Error("패턴 목록이 최신 상태와 일치하지 않습니다. 새로고침 후 다시 시도하세요.");
  }

  const tx = db.transaction(() => {
    orderedPatternKeys.forEach((key, i) => {
      db.prepare("UPDATE chip_layout_pattern_slots SET slot_index = ? WHERE id = ?").run(i, idByKey.get(key));
    });
  });
  tx();

  logAudit("reorder_chip_layout_pattern_slots", "chip_layout_pattern_slots", null, null, { batchId, orderedPatternKeys });
}

/** Full candidate list in a/b/c/... slot order (the persisted, user-reorderable order — see ensurePatternSlotsForBatch). */
function listPatternCandidatesInternal(batchId: number): PatternCandidateInternal[] {
  const raw = computeRawCandidates(batchId);
  ensurePatternSlotsForBatch(batchId, raw);

  const db = getDb();
  const slotRows = db
    .prepare("SELECT pattern_key FROM chip_layout_pattern_slots WHERE batch_id = ? ORDER BY slot_index ASC")
    .all(batchId) as { pattern_key: string }[];
  const rawMap = new Map(raw.map((c) => [c.patternKey, c]));

  return slotRows
    .map((row) => rawMap.get(row.pattern_key))
    .filter((c): c is Omit<PatternCandidateInternal, "slotIndex" | "slotLetter"> => c != null)
    .map((c, i) => ({ ...c, slotIndex: i, slotLetter: slotLetterFor(i) }));
}

/**
 * Removes placement instances (in any exposure job of this batch) referencing
 * a pattern no longer in this week's queue — nothing to keep in sync
 * otherwise, since patternKey isn't a foreign key.
 *
 * Call this ONLY from an action that can actually shrink a week's GDS
 * submissions (deleteSubmission — cutover no longer moves submissions between
 * weeks under the backlog model, so it has nothing left to prune) — never
 * from a read path. A
 * batch-scoping bug here once caused a plain page view to silently delete
 * real placements (candidates computed against the wrong week made everything
 * look orphaned); getPatternCandidates() no longer calls this for that reason.
 */
function pruneOrphanedPlacementInstances(batchId: number, candidates: { patternKey: string }[]): void {
  const db = getDb();
  const exposureJobIds = db.prepare("SELECT id FROM chip_layout_exposure_jobs WHERE batch_id = ?").all(batchId) as {
    id: number;
  }[];
  if (exposureJobIds.length === 0) return;

  const validKeys = new Set(candidates.map((c) => c.patternKey));
  const rows = db
    .prepare(
      `SELECT id, pattern_key FROM chip_layout_placement_instances WHERE exposure_job_id IN (${exposureJobIds
        .map(() => "?")
        .join(",")})`,
    )
    .all(...exposureJobIds.map((e) => e.id)) as { id: number; pattern_key: string }[];
  const staleIds = rows.filter((r) => !validKeys.has(r.pattern_key)).map((r) => r.id);
  if (staleIds.length === 0) return;

  const tx = db.transaction(() => {
    for (const id of staleIds) db.prepare("DELETE FROM chip_layout_placement_instances WHERE id = ?").run(id);
  });
  tx();
}

interface PatternSnapshotRow {
  pattern_key: string;
  slot_index: number;
  candidate_label: string;
  size_x_um: number;
  size_y_um: number;
  area_um2: number;
  svg_stored_path: string | null;
  grid_left_um: number;
  grid_bottom_um: number;
  grid_right_um: number;
  grid_top_um: number;
  layer: number;
  datatype: number;
}

function mapSnapshotRow(r: PatternSnapshotRow): PatternCandidateInternal {
  return {
    patternKey: r.pattern_key,
    slotIndex: r.slot_index,
    slotLetter: slotLetterFor(r.slot_index),
    candidateLabel: r.candidate_label,
    sizeXUm: r.size_x_um,
    sizeYUm: r.size_y_um,
    areaUm2: r.area_um2,
    svgStoredPath: r.svg_stored_path,
    gridLeftUm: r.grid_left_um,
    gridBottomUm: r.grid_bottom_um,
    gridRightUm: r.grid_right_um,
    gridTopUm: r.grid_top_um,
    layer: r.layer,
    datatype: r.datatype,
  };
}

function insertPatternSnapshot(batchId: number, candidates: PatternCandidateInternal[]): void {
  const db = getDb();
  const insert = db.prepare(
    `INSERT OR REPLACE INTO chip_layout_pattern_snapshots
       (batch_id, pattern_key, slot_index, candidate_label, size_x_um, size_y_um, area_um2, svg_stored_path,
        grid_left_um, grid_bottom_um, grid_right_um, grid_top_um, layer, datatype)
     VALUES (@batchId, @patternKey, @slotIndex, @candidateLabel, @sizeXUm, @sizeYUm, @areaUm2, @svgStoredPath,
             @gridLeftUm, @gridBottomUm, @gridRightUm, @gridTopUm, @layer, @datatype)`,
  );
  const tx = db.transaction(() => {
    for (const c of candidates) insert.run({ batchId, ...c });
  });
  tx();
}

/**
 * Frozen pattern-candidate list for a batch whose week has already closed —
 * populated lazily, once: the first time it's read after the week closes, it
 * freezes whatever computeRawCandidates says *right then* and stores it, so
 * later changes to that week's layout_submissions (e.g. a late "exposure
 * complete" filing under this week) can no longer alter what a past batch's
 * pattern view shows. Insert-only — a plain read never deletes anything here.
 */
function getOrCreateFrozenPatternSnapshot(batchId: number): PatternCandidateInternal[] {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM chip_layout_pattern_snapshots WHERE batch_id = ? ORDER BY slot_index ASC")
    .all(batchId) as PatternSnapshotRow[];
  if (existing.length > 0) return existing.map(mapSnapshotRow);

  const live = listPatternCandidatesInternal(batchId);
  if (live.length > 0) insertPatternSnapshot(batchId, live);
  return live;
}

function getPatternCandidates(batchId: number): PatternCandidateInternal[] {
  const batch = getJobOrThrow(batchId);
  const db = getDb();
  const week = db.prepare("SELECT status FROM weekly_queue_weeks WHERE week_id = ?").get(batch.weekId) as
    | { status: string }
    | undefined;
  if (week?.status === "closed") return getOrCreateFrozenPatternSnapshot(batchId);
  return listPatternCandidatesInternal(batchId);
}

/**
 * Re-freezes a user's batches' pattern snapshots for one (already-closed)
 * week — called when completeSubmission files a submission's completion
 * under a past week, since that can introduce a pattern that wasn't part of
 * this week's frozen snapshot yet. No-op for a still-open week (nothing
 * frozen there in the first place).
 */
export function refreshPatternSnapshotForUserWeek(equipmentUserId: number, weekId: string): void {
  const db = getDb();
  const week = db.prepare("SELECT status FROM weekly_queue_weeks WHERE week_id = ?").get(weekId) as
    | { status: string }
    | undefined;
  if (week?.status !== "closed") return;

  const batches = db
    .prepare("SELECT id FROM chip_layout_jobs WHERE equipment_user_id = ? AND week_id = ?")
    .all(equipmentUserId, weekId) as { id: number }[];
  for (const b of batches) {
    db.prepare("DELETE FROM chip_layout_pattern_snapshots WHERE batch_id = ?").run(b.id);
    getOrCreateFrozenPatternSnapshot(b.id);
  }
}

/**
 * Explicit orphan cleanup for one equipment user's batches in one queue week.
 * Call this right after an action that removes that week's GDS submissions
 * (currently only deleteSubmission — cutover doesn't move submissions
 * between weeks under the backlog model, so it never orphans anything here)
 * so any placement instance left pointing at a pattern that no longer exists
 * gets cleaned up immediately — deliberately, not as a side effect of
 * someone merely viewing the batch.
 */
export function pruneOrphanedPlacementsForUserWeek(equipmentUserId: number, weekId: string): void {
  const db = getDb();
  const batches = db
    .prepare("SELECT id FROM chip_layout_jobs WHERE equipment_user_id = ? AND week_id = ?")
    .all(equipmentUserId, weekId) as { id: number }[];
  for (const b of batches) {
    pruneOrphanedPlacementInstances(b.id, computeRawCandidates(b.id));
  }
}

/** Public read-only pattern catalog for a batch's "패턴 목록" panel. */
export function listPatternCandidates(batchId: number): PatternCandidate[] {
  return getPatternCandidates(batchId).map((c) => ({
    patternKey: c.patternKey,
    slotIndex: c.slotIndex,
    slotLetter: c.slotLetter,
    candidateLabel: c.candidateLabel,
    sizeXUm: c.sizeXUm,
    sizeYUm: c.sizeYUm,
  }));
}

// ---------------------------------------------------------------------------
// Exposure jobs (current / dose / scan step "recipes") — nested one level
// under a batch. Name is system-assigned and immutable.
// ---------------------------------------------------------------------------

export interface ExposureJob {
  id: number;
  batchId: number;
  name: string;
  currentNa: number;
  doseUcCm2: number;
  scanStep: number;
  windowKey: WindowKey;
}

interface ExposureJobRow {
  id: number;
  batch_id: number;
  name: string;
  current_na: number;
  dose_uc_cm2: number;
  scan_step: number;
  window_key: WindowKey;
}

function mapExposureJobRow(r: ExposureJobRow): ExposureJob {
  return {
    id: r.id,
    batchId: r.batch_id,
    name: r.name,
    currentNa: r.current_na,
    doseUcCm2: r.dose_uc_cm2,
    scanStep: r.scan_step,
    windowKey: r.window_key,
  };
}

function getExposureJobOrThrow(id: number): ExposureJob {
  const db = getDb();
  const row = db.prepare("SELECT * FROM chip_layout_exposure_jobs WHERE id = ?").get(id) as ExposureJobRow | undefined;
  if (!row) throw new Error("존재하지 않는 Job입니다");
  return mapExposureJobRow(row);
}

/** The device-spec floor for scan step at a given current/dose, per computeMinPixelResolution (same formula the submit page's 노광 해상도 display uses). */
function minScanStepFor(currentNa: number, doseUcCm2: number): number {
  const settings = getWeeklySettings();
  return computeMinPixelResolution({
    doseUcCm2,
    currentNa,
    minDwellNs: settings.minDwellNs,
    dwellMarginRatio: settings.dwellMarginRatio,
  }).stepSize;
}

function validateExposureJobInput(currentNa: number, doseUcCm2: number, scanStep: number): void {
  if (!Number.isFinite(currentNa) || currentNa <= 0) throw new Error("current는 0보다 커야 합니다");
  if (!Number.isFinite(doseUcCm2) || doseUcCm2 <= 0) throw new Error("dose는 0보다 커야 합니다");
  if (!Number.isInteger(scanStep) || scanStep <= 0) throw new Error("scan step은 자연수여야 합니다");
  const minStep = minScanStepFor(currentNa, doseUcCm2);
  if (scanStep < minStep) {
    throw new Error(`장비 스펙상 이 current/dose 조건에서 scan step은 최소 ${minStep} 이상이어야 합니다`);
  }
}

/** Standard default for every newly created exposure job (auto-created "Job1" or via the plain "Job 추가" button) — valid against current admin settings (verified: min scan step for 5nA/350µC/cm² is 8). */
function defaultExposureJobParams(cassetteType: CassetteType): { currentNa: number; doseUcCm2: number; scanStep: number; windowKey: WindowKey } {
  return { currentNa: 5, doseUcCm2: 350, scanStep: 8, windowKey: defaultWindowKeyForCassette(cassetteType) };
}

/** Lists a batch's exposure jobs, auto-creating a default "Job1" (with valid device-spec-satisfying defaults) the first time. */
export function listExposureJobs(batchId: number): ExposureJob[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM chip_layout_exposure_jobs WHERE batch_id = ? ORDER BY display_order ASC, id ASC")
    .all(batchId) as ExposureJobRow[];
  if (rows.length === 0) {
    createExposureJob(batchId);
    return listExposureJobs(batchId);
  }
  return rows.map(mapExposureJobRow);
}

export interface ExposureJobCreateInput {
  currentNa: number;
  doseUcCm2: number;
  scanStep: number;
  windowKey: WindowKey;
}

/** Creates an exposure job — any field left out falls back to the standard default (5nA / 350µC/cm² / 8 / the cassette's default window), matching the plain "Job 추가" button which sends no body at all. */
export function createExposureJob(batchId: number, input: Partial<ExposureJobCreateInput> = {}): ExposureJob {
  const db = getDb();
  const batch = getJobOrThrow(batchId);
  const defaults = defaultExposureJobParams(batch.cassetteType);
  const currentNa = input.currentNa ?? defaults.currentNa;
  const doseUcCm2 = input.doseUcCm2 ?? defaults.doseUcCm2;
  const scanStep = input.scanStep ?? defaults.scanStep;
  const windowKey = input.windowKey ?? defaults.windowKey;
  validateExposureJobInput(currentNa, doseUcCm2, scanStep);
  validateWindowKey(batch.cassetteType, windowKey);

  const existing = db.prepare("SELECT name FROM chip_layout_exposure_jobs WHERE batch_id = ?").all(batchId) as {
    name: string;
  }[];
  const name = nextDefaultName(existing.map((e) => e.name), "Job");
  const maxOrder = db
    .prepare("SELECT COALESCE(MAX(display_order), 0) AS m FROM chip_layout_exposure_jobs WHERE batch_id = ?")
    .get(batchId) as { m: number };

  const result = db
    .prepare(
      `INSERT INTO chip_layout_exposure_jobs (batch_id, name, current_na, dose_uc_cm2, scan_step, window_key, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(batchId, name, currentNa, doseUcCm2, scanStep, windowKey, maxOrder.m + 1);
  const id = Number(result.lastInsertRowid);
  logAudit("create_chip_layout_exposure_job", "chip_layout_exposure_jobs", id, null, {
    batchId,
    name,
    currentNa,
    doseUcCm2,
    scanStep,
    windowKey,
  });
  return getExposureJobOrThrow(id);
}

export interface ExposureJobUpdateInput {
  currentNa?: number;
  doseUcCm2?: number;
  scanStep?: number;
  windowKey?: WindowKey;
}

export function updateExposureJob(id: number, input: ExposureJobUpdateInput): ExposureJob {
  const db = getDb();
  const before = getExposureJobOrThrow(id);
  const batch = getJobOrThrow(before.batchId);
  const currentNa = input.currentNa ?? before.currentNa;
  const doseUcCm2 = input.doseUcCm2 ?? before.doseUcCm2;
  const scanStep = input.scanStep ?? before.scanStep;
  const windowKey = input.windowKey ?? before.windowKey;
  validateExposureJobInput(currentNa, doseUcCm2, scanStep);
  if (input.windowKey !== undefined) validateWindowKey(batch.cassetteType, windowKey);

  db.prepare(
    `UPDATE chip_layout_exposure_jobs SET current_na = ?, dose_uc_cm2 = ?, scan_step = ?, window_key = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(currentNa, doseUcCm2, scanStep, windowKey, id);
  const after = getExposureJobOrThrow(id);
  logAudit("update_chip_layout_exposure_job", "chip_layout_exposure_jobs", id, before, after);
  return after;
}

export function deleteExposureJob(id: number): void {
  const db = getDb();
  const before = getExposureJobOrThrow(id);
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM chip_layout_placement_instances WHERE exposure_job_id = ?").run(id);
    db.prepare("DELETE FROM chip_layout_exposure_jobs WHERE id = ?").run(id);
  });
  tx();
  logAudit("delete_chip_layout_exposure_job", "chip_layout_exposure_jobs", id, before, null);
}

// ---------------------------------------------------------------------------
// Placement instances — one physical placement of one pattern within one
// exposure job. Deliberately not unique on pattern_key: the same pattern can
// be placed more than once (even within the same exposure job).
// ---------------------------------------------------------------------------

export interface PlacementInstance {
  id: number;
  exposureJobId: number;
  patternKey: string;
  slotLetter: string;
  candidateLabel: string;
  sizeXUm: number;
  sizeYUm: number;
  /** Not stored on the instance — always the owning exposure job's window, since a job writes to one physical cassette window in a single run. */
  windowKey: WindowKey;
  centerXUm: number;
  centerYUm: number;
}

interface PlacementInstanceRow {
  id: number;
  exposure_job_id: number;
  pattern_key: string;
  center_x_um: number;
  center_y_um: number;
}

export function listPlacementInstances(exposureJobId: number): PlacementInstance[] {
  const db = getDb();
  const exposureJob = getExposureJobOrThrow(exposureJobId);
  const candidates = getPatternCandidates(exposureJob.batchId);
  const candidateMap = new Map(candidates.map((c) => [c.patternKey, c]));

  const rows = db
    .prepare("SELECT * FROM chip_layout_placement_instances WHERE exposure_job_id = ? ORDER BY id ASC")
    .all(exposureJobId) as PlacementInstanceRow[];

  return rows
    .map((r) => {
      const c = candidateMap.get(r.pattern_key);
      return {
        id: r.id,
        exposureJobId: r.exposure_job_id,
        patternKey: r.pattern_key,
        slotIndex: c?.slotIndex ?? Number.MAX_SAFE_INTEGER,
        slotLetter: c?.slotLetter ?? "?",
        candidateLabel: c?.candidateLabel ?? "(사라진 패턴)",
        sizeXUm: c?.sizeXUm ?? 0,
        sizeYUm: c?.sizeYUm ?? 0,
        windowKey: exposureJob.windowKey,
        centerXUm: r.center_x_um,
        centerYUm: r.center_y_um,
      };
    })
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .map(({ slotIndex, ...rest }) => {
      void slotIndex;
      return rest;
    });
}

export interface PlacementInstanceCreateInput {
  patternKey: string;
  centerXUm?: number;
  centerYUm?: number;
}

export function createPlacementInstance(exposureJobId: number, input: PlacementInstanceCreateInput): PlacementInstance {
  const db = getDb();
  const exposureJob = getExposureJobOrThrow(exposureJobId);

  const candidates = getPatternCandidates(exposureJob.batchId);
  if (!candidates.some((c) => c.patternKey === input.patternKey)) {
    throw new Error("존재하지 않는 패턴입니다");
  }

  const result = db
    .prepare(
      `INSERT INTO chip_layout_placement_instances (exposure_job_id, pattern_key, center_x_um, center_y_um)
       VALUES (?, ?, ?, ?)`,
    )
    .run(exposureJobId, input.patternKey, input.centerXUm ?? 0, input.centerYUm ?? 0);
  const id = Number(result.lastInsertRowid);
  logAudit("create_chip_layout_placement_instance", "chip_layout_placement_instances", id, null, {
    exposureJobId,
    ...input,
  });

  return listPlacementInstances(exposureJobId).find((p) => p.id === id)!;
}

export interface PlacementInstanceUpdateInput {
  centerXUm?: number;
  centerYUm?: number;
}

export function updatePlacementInstance(id: number, input: PlacementInstanceUpdateInput): PlacementInstance {
  const db = getDb();
  const row = db.prepare("SELECT * FROM chip_layout_placement_instances WHERE id = ?").get(id) as
    | PlacementInstanceRow
    | undefined;
  if (!row) throw new Error("존재하지 않는 배치입니다");

  const centerXUm = input.centerXUm ?? row.center_x_um;
  const centerYUm = input.centerYUm ?? row.center_y_um;

  db.prepare(
    `UPDATE chip_layout_placement_instances SET center_x_um = ?, center_y_um = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(centerXUm, centerYUm, id);
  logAudit("update_chip_layout_placement_instance", "chip_layout_placement_instances", id, row, {
    centerXUm,
    centerYUm,
  });

  return listPlacementInstances(row.exposure_job_id).find((p) => p.id === id)!;
}

export function deletePlacementInstance(id: number): void {
  const db = getDb();
  const before = db.prepare("SELECT * FROM chip_layout_placement_instances WHERE id = ?").get(id);
  db.prepare("DELETE FROM chip_layout_placement_instances WHERE id = ?").run(id);
  logAudit("delete_chip_layout_placement_instance", "chip_layout_placement_instances", id, before, null);
}

// ---------------------------------------------------------------------------
// Batch-wide exposure time summary — sums estimateExposureTime across every
// placement instance of every exposure job in the batch.
// ---------------------------------------------------------------------------

export interface ExposureSummary {
  calculatedSeconds: number;
  minSeconds: number;
  maxSeconds: number;
}

export function computeBatchExposureSummary(batchId: number): ExposureSummary {
  const db = getDb();
  const settings = getWeeklySettings();
  const candidateMap = new Map(getPatternCandidates(batchId).map((c) => [c.patternKey, c]));

  const exposureJobs = db
    .prepare("SELECT * FROM chip_layout_exposure_jobs WHERE batch_id = ?")
    .all(batchId) as ExposureJobRow[];

  let calculatedSeconds = 0;
  let minSeconds = 0;
  let maxSeconds = 0;

  for (const job of exposureJobs) {
    const instances = db
      .prepare("SELECT pattern_key FROM chip_layout_placement_instances WHERE exposure_job_id = ?")
      .all(job.id) as { pattern_key: string }[];
    for (const inst of instances) {
      const candidate = candidateMap.get(inst.pattern_key);
      if (!candidate) continue;
      const est = estimateExposureTime({
        areaUm2: candidate.areaUm2,
        doseUcCm2: job.dose_uc_cm2,
        currentNa: job.current_na,
        layerCount: 1,
        calibrationSeconds: settings.calibrationCostMinutes * 60,
        perLayerSeconds: settings.perLayerCostSeconds,
      });
      calculatedSeconds += est.timeCalculatedSeconds;
      minSeconds += est.timeMinSeconds;
      maxSeconds += est.timeMaxSeconds;
    }
  }

  return { calculatedSeconds, minSeconds, maxSeconds };
}

// ---------------------------------------------------------------------------
// "전체 패턴 뷰" preview SVG generation — one file per window, sourcing chips
// (unchanged) and now every placement instance across every exposure job in
// the batch (duplicates render as separate shapes, exactly as placed).
// ---------------------------------------------------------------------------

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Pulls the one <g data-layer="L:D"> group belonging to this pattern out of
 * its source submission's already-converted GDS SVG file, and translates it
 * so its own grid-bounds center lands exactly at (targetSvgX, targetSvgY) —
 * the placement's center in the preview's coordinate space. Returns null
 * (caller falls back to a plain contour) if the file or that layer group
 * can't be found.
 */
function extractTranslatedPatternShape(
  svgStoredPath: string,
  layer: number,
  datatype: number,
  gridLeftUm: number,
  gridBottomUm: number,
  gridRightUm: number,
  gridTopUm: number,
  targetSvgX: number,
  targetSvgY: number,
): string | null {
  if (!fs.existsSync(svgStoredPath)) return null;
  const raw = fs.readFileSync(svgStoredPath, "utf-8");
  const groupMatch = raw.match(new RegExp(`<g[^>]*data-layer="${layer}:${datatype}"[^>]*>([\\s\\S]*?)<\\/g>`));
  if (!groupMatch) return null;

  // The source file's own content lives in "svg_y = -real_y" space (see
  // LayoutGridPreview); its grid-bounds center in that same space is:
  const originalCenterSvgX = (gridLeftUm + gridRightUm) / 2;
  const originalCenterSvgY = -(gridBottomUm + gridTopUm) / 2;
  const dx = targetSvgX - originalCenterSvgX;
  const dy = targetSvgY - originalCenterSvgY;
  return `<g transform="translate(${dx},${dy})">${groupMatch[1]}</g>`;
}

const PREVIEW_SVG_DIR = path.resolve(process.cwd(), "../../data/chip-layouts/svg");

export function getJobPreviewSvgPath(jobId: number, windowKey: WindowKey): string {
  return path.join(PREVIEW_SVG_DIR, `job-${jobId}-${windowKey}.svg`);
}

const ALL_WINDOW_KEYS: WindowKey[] = ["A", "B", "D"];

const MARGIN_TOP_BOTTOM_UM = 4 * MM;
const MARGIN_LEFT_UM = 10 * MM;
const MARGIN_RIGHT_UM = 3 * MM;
const BORDER_STROKE_UM = 100;
const PATTERN_STROKE_UM = 80;
const LABEL_FONT_UM = 1000;
const TICK_FONT_UM = 800;
const TICK_MINOR_LEN_UM = 1 * MM;
const TICK_MAJOR_LEN_UM = 2.2 * MM;

function formatMmTickLabel(mm: number): string {
  if (mm === 0) return "0mm";
  return mm > 0 ? `+${mm}mm` : `${mm}mm`;
}

/**
 * Ruler for the exported "전체 패턴 뷰" preview — unlike WindowCanvas's live-editor
 * ruler (which pokes minor ticks inward), every tick here stays outside the
 * window rect so the interior is left completely clean for reading placements.
 * X ticks run along the top and bottom edges, Y ticks along the left edge only;
 * 1mm minor ticks are unlabeled, 5mm/0 major ticks are longer and labeled.
 */
function buildOutsideTicks(widthUm: number, heightUm: number, topEdgeUm: number, bottomEdgeUm: number, leftEdgeUm: number): string {
  const parts: string[] = [];
  const halfWMm = Math.round(widthUm / MM / 2);
  const halfHMm = Math.round(heightUm / MM / 2);

  for (let xMm = -halfWMm; xMm <= halfWMm; xMm++) {
    const xUm = xMm * MM;
    const isMajor = xMm % 5 === 0;
    const len = isMajor ? TICK_MAJOR_LEN_UM : TICK_MINOR_LEN_UM;
    const strokeWidth = isMajor ? (xMm === 0 ? 150 : 100) : 60;
    parts.push(
      `<line x1="${xUm}" y1="${topEdgeUm}" x2="${xUm}" y2="${topEdgeUm - len}" stroke="currentColor" stroke-width="${strokeWidth}" />`,
      `<line x1="${xUm}" y1="${bottomEdgeUm}" x2="${xUm}" y2="${bottomEdgeUm + len}" stroke="currentColor" stroke-width="${strokeWidth}" />`,
    );
    if (isMajor) {
      parts.push(
        `<text x="${xUm}" y="${topEdgeUm - len - TICK_FONT_UM * 0.5}" font-size="${TICK_FONT_UM}" text-anchor="middle" fill="currentColor" opacity="0.7">${formatMmTickLabel(xMm)}</text>`,
        `<text x="${xUm}" y="${bottomEdgeUm + len + TICK_FONT_UM * 1.1}" font-size="${TICK_FONT_UM}" text-anchor="middle" fill="currentColor" opacity="0.7">${formatMmTickLabel(xMm)}</text>`,
      );
    }
  }

  for (let yMm = -halfHMm; yMm <= halfHMm; yMm++) {
    const yUm = yMm * MM;
    const isMajor = yMm % 5 === 0;
    const len = isMajor ? TICK_MAJOR_LEN_UM : TICK_MINOR_LEN_UM;
    const strokeWidth = isMajor ? (yMm === 0 ? 150 : 100) : 60;
    // svg_y = -real_y, so a more negative real y (further down the physical window) is a larger svg y.
    parts.push(`<line x1="${leftEdgeUm}" y1="${-yUm}" x2="${leftEdgeUm - len}" y2="${-yUm}" stroke="currentColor" stroke-width="${strokeWidth}" />`);
    if (isMajor) {
      parts.push(
        `<text x="${leftEdgeUm - len - TICK_FONT_UM * 0.5}" y="${-yUm}" font-size="${TICK_FONT_UM}" text-anchor="end" dominant-baseline="middle" fill="currentColor" opacity="0.7">${formatMmTickLabel(yMm)}</text>`,
      );
    }
  }

  return parts.join("");
}

/**
 * Renders one SVG file per window of the batch's cassette — each self
 * contained (its own window rect, chip backgrounds, placed pattern
 * outlines, centered on that window's own (0,0)) — in the same
 * viewBox-wrapped format LayoutGridPreview already knows how to
 * pan/zoom/scale-bar. The "전체 패턴 뷰" page picks which one to show via a
 * window combobox. Removes any stale file for a window the batch's current
 * cassette type no longer has.
 */
export function generateJobPreviewSvgs(batchId: number): void {
  const batch = getJobOrThrow(batchId);
  const windows = getWindowsForCassette(batch.cassetteType);
  const chips = listChips(batchId);
  const candidateMap = new Map(getPatternCandidates(batchId).map((c) => [c.patternKey, c]));

  const db = getDb();
  const instances = db
    .prepare(
      `SELECT pi.pattern_key AS pattern_key, ej.window_key AS window_key, pi.center_x_um AS center_x_um, pi.center_y_um AS center_y_um
       FROM chip_layout_placement_instances pi
       JOIN chip_layout_exposure_jobs ej ON ej.id = pi.exposure_job_id
       WHERE ej.batch_id = ?`,
    )
    .all(batchId) as {
    pattern_key: string;
    window_key: WindowKey;
    center_x_um: number;
    center_y_um: number;
  }[];

  fs.mkdirSync(PREVIEW_SVG_DIR, { recursive: true });

  const activeKeys = new Set(windows.map((w) => w.key));
  for (const key of ALL_WINDOW_KEYS) {
    if (!activeKeys.has(key)) fs.rmSync(getJobPreviewSvgPath(batchId, key), { force: true });
  }

  for (const w of windows) {
    const parts: string[] = [];
    const topEdge = -w.heightUm / 2;

    parts.push(
      `<rect x="${-w.widthUm / 2}" y="${topEdge}" width="${w.widthUm}" height="${w.heightUm}" fill="none" stroke="currentColor" stroke-width="${BORDER_STROKE_UM}" />`,
    );

    chips
      .filter((chip) => chip.windowKey === w.key)
      .forEach((chip) => {
        const colorIndex = chips.findIndex((c) => c.id === chip.id);
        const x = chip.centerXUm - chip.widthUm / 2;
        parts.push(`<rect x="${x}" y="${topEdge}" width="${chip.widthUm}" height="${w.heightUm}" fill="${chipFillColor(colorIndex)}" />`);
        parts.push(
          `<text x="${x + LABEL_FONT_UM * 0.3}" y="${topEdge + LABEL_FONT_UM * 0.9}" font-size="${LABEL_FONT_UM * 0.8}" fill="currentColor">${escapeXml(chip.name)}</text>`,
        );
      });

    for (const inst of instances.filter((i) => i.window_key === w.key)) {
      const candidate = candidateMap.get(inst.pattern_key);
      if (!candidate) continue;
      const svgCenterY = -inst.center_y_um;

      const shape = candidate.svgStoredPath
        ? extractTranslatedPatternShape(
            candidate.svgStoredPath,
            candidate.layer,
            candidate.datatype,
            candidate.gridLeftUm,
            candidate.gridBottomUm,
            candidate.gridRightUm,
            candidate.gridTopUm,
            inst.center_x_um,
            svgCenterY,
          )
        : null;

      if (shape) {
        parts.push(shape);
      } else {
        const x = inst.center_x_um - candidate.sizeXUm / 2;
        const y = svgCenterY - candidate.sizeYUm / 2;
        parts.push(
          `<rect x="${x}" y="${y}" width="${candidate.sizeXUm}" height="${candidate.sizeYUm}" fill="none" stroke="#dc2626" stroke-width="${PATTERN_STROKE_UM}" />`,
        );
      }
      parts.push(
        `<text x="${inst.center_x_um}" y="${svgCenterY - candidate.sizeYUm / 2 - LABEL_FONT_UM * 0.6}" font-size="${LABEL_FONT_UM}" text-anchor="middle" fill="#dc2626">${escapeXml(candidate.slotLetter)}</text>`,
      );
    }

    const bottomEdge = topEdge + w.heightUm;
    const leftEdge = -w.widthUm / 2;
    parts.push(buildOutsideTicks(w.widthUm, w.heightUm, topEdge, bottomEdge, leftEdge));

    const minX = leftEdge - MARGIN_LEFT_UM;
    const width = w.widthUm + MARGIN_LEFT_UM + MARGIN_RIGHT_UM;
    const minY = topEdge - MARGIN_TOP_BOTTOM_UM;
    const height = w.heightUm + MARGIN_TOP_BOTTOM_UM * 2;

    const svg = `<svg viewBox="${minX} ${minY} ${width} ${height}"><g class="text-black dark:text-white">${parts.join("")}</g></svg>`;
    fs.writeFileSync(getJobPreviewSvgPath(batchId, w.key), svg, "utf-8");
  }
}
