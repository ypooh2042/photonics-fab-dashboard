import fs from "node:fs";
import path from "node:path";

// layout-convert uploads/converted files have no DB row tracking their
// lifetime (unlike gds-uploads, which lives as long as its layout_submissions
// row does) — it's a one-off scratch tool, so nothing ever deletes them
// except the user manually hitting 취소 (which only covers the *pre-convert*
// upload, not the converted output). Left alone, both directories grow
// forever. Instead of a cron/systemd timer, sweep opportunistically on every
// request that touches these directories — cheap for the small file counts
// this tool sees, and doesn't need any extra infra.
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h — generous for a same-session upload/convert/download workflow

export function sweepOldFiles(dir: string, maxAgeMs: number = MAX_AGE_MS): void {
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return; // directory doesn't exist yet — nothing to sweep
  }

  const now = Date.now();
  for (const name of entries) {
    const filePath = path.join(dir, name);
    try {
      const stat = fs.statSync(filePath);
      if (stat.isFile() && now - stat.mtimeMs > maxAgeMs) {
        fs.rmSync(filePath, { force: true });
      }
    } catch {
      // best-effort — ignore races (e.g. concurrent request deleted it first)
    }
  }
}
