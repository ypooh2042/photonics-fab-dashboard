import { getDb } from "./db";

export function logAudit(
  action: string,
  entityType: string,
  entityId: number | null,
  before: unknown,
  after: unknown,
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO audit_log (actor, action, entity_type, entity_id, before_json, after_json)
     VALUES ('admin', ?, ?, ?, ?, ?)`,
  ).run(action, entityType, entityId, JSON.stringify(before), JSON.stringify(after));
}
