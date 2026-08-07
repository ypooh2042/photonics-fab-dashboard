import Database from "better-sqlite3";
import path from "node:path";

let instance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!instance) {
    const dbPath = path.resolve(
      /*turbopackIgnore: true*/ process.cwd(),
      process.env.DB_PATH ?? "../../data/fab_dashboard.sqlite",
    );
    instance = new Database(dbPath, { readonly: false });
    instance.pragma("journal_mode = WAL");
    instance.pragma("foreign_keys = ON");
  }
  return instance;
}
