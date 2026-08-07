import { getDb } from "./db";
import { logAudit } from "./audit";
import { getWeeklySettings, getOpenWeekId, setWeekUserSnapshot, recomputeWeekUser } from "./queue";

const ALIAS_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

export interface EquipmentUser {
  id: number;
  name: string;
  alias: string;
  isPermanent: boolean;
  capacityHours: number;
  loadingCostMinutes: number;
  displayOrder: number;
}

function mapRow(r: {
  id: number;
  name: string;
  alias: string;
  is_permanent: number;
  capacity_hours: number;
  loading_cost_minutes: number;
  display_order: number;
}): EquipmentUser {
  return {
    id: r.id,
    name: r.name,
    alias: r.alias,
    isPermanent: !!r.is_permanent,
    capacityHours: r.capacity_hours,
    loadingCostMinutes: r.loading_cost_minutes,
    displayOrder: r.display_order,
  };
}

export function listEquipmentUsers(): EquipmentUser[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM equipment_users ORDER BY display_order ASC, id ASC").all() as Parameters<
    typeof mapRow
  >[0][];
  return rows.map(mapRow);
}

export function getEquipmentUser(id: number): EquipmentUser | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM equipment_users WHERE id = ?").get(id) as
    | Parameters<typeof mapRow>[0]
    | undefined;
  return row ? mapRow(row) : null;
}

function validateAlias(alias: string): string {
  const trimmed = alias.trim();
  if (!ALIAS_PATTERN.test(trimmed)) {
    throw new Error("별명은 영문으로 시작하고 영문/숫자/밑줄(_)만 포함할 수 있습니다");
  }
  return trimmed;
}

export interface EquipmentUserCreateInput {
  name: string;
  alias: string;
  isPermanent: boolean;
}

export function createEquipmentUser(input: EquipmentUserCreateInput): EquipmentUser {
  const db = getDb();
  const name = input.name.trim();
  if (!name) throw new Error("이름을 입력해주세요");
  const alias = validateAlias(input.alias);

  const existing = db.prepare("SELECT 1 FROM equipment_users WHERE alias = ? COLLATE NOCASE").get(alias);
  if (existing) throw new Error("이미 사용 중인 별명입니다");

  const maxOrder = db.prepare("SELECT COALESCE(MAX(display_order), 0) AS m FROM equipment_users").get() as {
    m: number;
  };
  const defaultLoadingCostMinutes = 40;

  const result = db
    .prepare(
      `INSERT INTO equipment_users (name, alias, is_permanent, capacity_hours, loading_cost_minutes, display_order)
       VALUES (?, ?, ?, 0, ?, ?)`,
    )
    .run(name, alias, input.isPermanent ? 1 : 0, defaultLoadingCostMinutes, maxOrder.m + 1);

  const id = Number(result.lastInsertRowid);
  logAudit("create_equipment_user", "equipment_users", id, null, { name, alias, isPermanent: input.isPermanent });

  // capacityHours starts at 0 regardless of isPermanent — the total/permanent
  // split is only auto-applied when the total capacity setting itself
  // changes (see rebalancePermanentCapacities). Adding a user shifts the
  // sum-must-equal-total invariant out of balance on purpose; the admin
  // reconciles it via updateEquipmentUserCapacities, which validates the sum.

  return getEquipmentUser(id)!;
}

export interface EquipmentUserUpdateInput {
  name?: string;
  alias?: string;
  isPermanent?: boolean;
  loadingCostMinutes?: number;
}

/**
 * Updates identity/permanent-flag/loadingCostMinutes fields — capacityHours is
 * managed exclusively via updateEquipmentUserCapacities (batch, sum-validated),
 * since it participates in a sum invariant that loadingCostMinutes doesn't.
 */
export function updateEquipmentUser(id: number, input: EquipmentUserUpdateInput): EquipmentUser {
  const db = getDb();
  const before = getEquipmentUser(id);
  if (!before) throw new Error("존재하지 않는 장비 사용자입니다");

  const name = input.name !== undefined ? input.name.trim() : before.name;
  if (!name) throw new Error("이름을 입력해주세요");

  const alias = input.alias !== undefined ? validateAlias(input.alias) : before.alias;
  if (alias.toLowerCase() !== before.alias.toLowerCase()) {
    const existing = db
      .prepare("SELECT 1 FROM equipment_users WHERE alias = ? COLLATE NOCASE AND id != ?")
      .get(alias, id);
    if (existing) throw new Error("이미 사용 중인 별명입니다");
  }

  const isPermanent = input.isPermanent !== undefined ? input.isPermanent : before.isPermanent;

  if (input.loadingCostMinutes !== undefined) {
    if (!Number.isFinite(input.loadingCostMinutes) || input.loadingCostMinutes < 0) {
      throw new Error("로딩 시간은 0 이상이어야 합니다");
    }
  }
  const loadingCostMinutes = input.loadingCostMinutes !== undefined ? input.loadingCostMinutes : before.loadingCostMinutes;

  db.prepare(
    `UPDATE equipment_users SET name = ?, alias = ?, is_permanent = ?, loading_cost_minutes = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(name, alias, isPermanent ? 1 : 0, loadingCostMinutes, id);

  const after = getEquipmentUser(id)!;
  logAudit("update_equipment_user", "equipment_users", id, before, after);

  // loadingCostMinutes here is only the default seeded into brand-new weeks —
  // the currently open week already has its own loading_cost_minutes_snapshot
  // (see queue.ts), editable only from the chip-layout job editor, so this
  // change intentionally does not cascade into it.

  return after;
}

export function deleteEquipmentUser(id: number): void {
  const db = getDb();
  const before = getEquipmentUser(id);
  if (!before) return;

  const referenced = db.prepare("SELECT 1 FROM layout_submissions WHERE equipment_user_id = ?").get(id);
  if (referenced) throw new Error("이미 노광 신청 내역이 있는 장비 사용자는 삭제할 수 없습니다");

  db.prepare("DELETE FROM weekly_queue_week_users WHERE equipment_user_id = ?").run(id);
  db.prepare("DELETE FROM equipment_users WHERE id = ?").run(id);
  logAudit("delete_equipment_user", "equipment_users", id, before, null);
}

const SUM_EPSILON = 1e-6;

export interface CapacityUpdateInput {
  id: number;
  capacityHours: number;
}

/**
 * Batch-updates every equipment user's capacityHours at once (permanent and
 * non-permanent alike) and enforces the invariant that the sum across ALL
 * equipment users equals the total weekly capacity setting — the request
 * must cover every existing equipment user, and is rejected outright if the
 * sum doesn't match (no silent redistribution; the admin decides how the
 * total is split).
 */
export function updateEquipmentUserCapacities(updates: CapacityUpdateInput[]): EquipmentUser[] {
  const settings = getWeeklySettings();
  const allUsers = listEquipmentUsers();
  const allIds = new Set(allUsers.map((u) => u.id));
  const updateIds = new Set(updates.map((u) => u.id));

  if (allIds.size !== updateIds.size || [...allIds].some((id) => !updateIds.has(id))) {
    throw new Error("모든 장비 사용자의 가용시간을 함께 입력해야 합니다");
  }
  for (const u of updates) {
    if (!Number.isFinite(u.capacityHours) || u.capacityHours < 0) {
      throw new Error("가용시간은 0 이상이어야 합니다");
    }
  }

  const sum = updates.reduce((s, u) => s + u.capacityHours, 0);
  if (Math.abs(sum - settings.weeklyCapacityHours) > SUM_EPSILON) {
    throw new Error(
      `가용시간 합(${sum.toFixed(2)}시간)이 총 가용시간(${settings.weeklyCapacityHours}시간)과 일치하지 않습니다`,
    );
  }

  const db = getDb();
  const update = db.prepare(
    "UPDATE equipment_users SET capacity_hours = ?, updated_at = datetime('now') WHERE id = ?",
  );
  const tx = db.transaction(() => {
    for (const u of updates) update.run(u.capacityHours, u.id);
  });
  tx();
  logAudit("update_equipment_user_capacities", "equipment_users", null, allUsers, updates);

  for (const u of updates) propagateCapacityToOpenWeek(u.id, u.capacityHours);

  return listEquipmentUsers();
}

/**
 * Evenly re-splits the total weekly capacity across every permanent
 * equipment user, leaving non-permanent users' capacity untouched — the sum
 * of all non-permanent capacities is subtracted from the new total first, so
 * the sum-across-everyone invariant holds automatically right after this
 * runs. This is the ONLY place capacity gets auto-overwritten: it fires
 * exclusively when the total weekly_capacity_hours setting itself changes
 * (see updateWeeklySettings in admin-data.ts) — individual edits elsewhere
 * (updateEquipmentUserCapacities) always persist until the next total change.
 */
export function rebalancePermanentCapacities(): void {
  const db = getDb();
  const settings = getWeeklySettings();
  const permanentUsers = db.prepare("SELECT id FROM equipment_users WHERE is_permanent = 1").all() as {
    id: number;
  }[];
  const nonPermanentSum = db
    .prepare("SELECT COALESCE(SUM(capacity_hours), 0) AS s FROM equipment_users WHERE is_permanent = 0")
    .get() as { s: number };
  const remaining = Math.max(0, settings.weeklyCapacityHours - nonPermanentSum.s);
  const share = permanentUsers.length > 0 ? remaining / permanentUsers.length : 0;

  const update = db.prepare(
    "UPDATE equipment_users SET capacity_hours = ?, updated_at = datetime('now') WHERE id = ?",
  );
  for (const u of permanentUsers) update.run(share, u.id);

  for (const u of permanentUsers) propagateCapacityToOpenWeek(u.id, share);
}

function propagateCapacityToOpenWeek(equipmentUserId: number, capacityHours: number): void {
  const weekId = getOpenWeekId();
  if (!weekId) return;
  setWeekUserSnapshot(weekId, equipmentUserId, capacityHours);
  recomputeWeekUser(weekId, equipmentUserId);
}
