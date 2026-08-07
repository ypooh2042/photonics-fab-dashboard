export const STAGE_TYPES = [
  "cleaning",
  "resist_coating",
  "e_beam_lithography",
  "development",
  "etching",
  "deposition",
  "dicing",
  "delivery",
  "completed_other",
  "other",
] as const;

export const STAGE_STATUSES = ["pending", "in_progress", "complete", "blocked", "skipped"] as const;

export type StageType = (typeof STAGE_TYPES)[number];
export type StageStatus = (typeof STAGE_STATUSES)[number];
