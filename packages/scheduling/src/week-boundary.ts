export interface CutoverSettings {
  cutoverDayOfWeek: number; // 0=Sun..6=Sat
  cutoverHour: number;
  cutoverMinute: number;
  timezone: string;
}

function zonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: parts.hour === "24" ? 0 : Number(parts.hour),
    minute: Number(parts.minute),
    weekday: weekdayMap[parts.weekday],
  };
}

/**
 * Returns the ISO date (YYYY-MM-DD) of the most recent cutover boundary at or
 * before `now`, interpreted in the configured timezone. This is the week_id
 * used to group a "week" of layout submissions between cutovers.
 */
export function currentWeekId(settings: CutoverSettings, now: Date = new Date()): string {
  const p = zonedParts(now, settings.timezone);
  let daysBack = (p.weekday - settings.cutoverDayOfWeek + 7) % 7;

  const nowMinutes = p.hour * 60 + p.minute;
  const cutoverMinutes = settings.cutoverHour * 60 + settings.cutoverMinute;
  if (daysBack === 0 && nowMinutes < cutoverMinutes) {
    daysBack = 7;
  }

  const candidateUtcMs = Date.UTC(p.year, p.month - 1, p.day) - daysBack * 86_400_000;
  return new Date(candidateUtcMs).toISOString().slice(0, 10);
}

export interface WeekDescription {
  monthOfYear: number; // 1-12, month of the week's start date (weekId)
  weekOfMonth: number; // nth occurrence of that weekday within the month (1-based)
  startDate: string; // YYYY-MM-DD, same as weekId
  endDate: string; // YYYY-MM-DD, weekId + 6 days
}

/**
 * Describes a week_id as "n월 m주차" (nth occurrence of the week's starting
 * weekday within its month) plus its start/end calendar dates. `weekOfMonth`
 * works for any weekday, not just the start day, because same-weekday dates
 * within a month are always exactly 7 days apart — so floor((day-1)/7)+1
 * gives the same answer regardless of which weekday the month happens to
 * start on.
 */
export function describeWeek(weekId: string): WeekDescription {
  const [y, m, d] = weekId.split("-").map(Number);
  const endUtcMs = Date.UTC(y, m - 1, d) + 6 * 86_400_000;
  const end = new Date(endUtcMs);

  return {
    monthOfYear: m,
    weekOfMonth: Math.floor((d - 1) / 7) + 1,
    startDate: weekId,
    endDate: `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`,
  };
}

/** Formats a week_id as e.g. "8월 1주차(2026.08.05. ~ 2026.08.11.)". */
export function formatWeekLabel(weekId: string): string {
  const { monthOfYear, weekOfMonth, startDate, endDate } = describeWeek(weekId);
  const dot = (iso: string) => iso.replaceAll("-", ".") + ".";
  return `${monthOfYear}월 ${weekOfMonth}주차(${dot(startDate)} ~ ${dot(endDate)})`;
}

/** Formats a week_id as a filesystem folder name, e.g. "2608_week1". */
export function weekFolderName(weekId: string): string {
  const { monthOfYear, weekOfMonth, startDate } = describeWeek(weekId);
  const yy = startDate.slice(2, 4);
  const mm = String(monthOfYear).padStart(2, "0");
  return `${yy}${mm}_week${weekOfMonth}`;
}
