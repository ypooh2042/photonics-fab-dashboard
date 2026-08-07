export interface Job {
  id: number;
  submittedAt: string; // ISO timestamp — authoritative FCFS key
  currentNa: number;
  minSeconds: number;
  maxSeconds: number;
}

export type QueueColor = "green" | "yellow" | "orange";

export interface ScheduleResult {
  id: number;
  minTotalSeconds: number;
  maxTotalSeconds: number;
  color: QueueColor;
}

/**
 * Loading cost (30 min default) is charged once per distinct e-beam current
 * that appears in the week, the first time it's seen in FCFS order — not per
 * job and not per switch. Physical execution can batch same-current jobs
 * together to realize this; the schedule here only needs to reflect the cost
 * accounting, not dictate execution order.
 */
export function scheduleWeek(
  jobs: Job[],
  capacityHours: number,
  loadingCostMinutes: number,
): ScheduleResult[] {
  const sorted = [...jobs].sort((a, b) =>
    a.submittedAt.localeCompare(b.submittedAt),
  );
  const capacitySeconds = capacityHours * 3600;
  const loadingCostSeconds = loadingCostMinutes * 60;
  const seenCurrents = new Set<number>();
  let minTotal = 0;
  let maxTotal = 0;

  return sorted.map((job) => {
    if (!seenCurrents.has(job.currentNa)) {
      seenCurrents.add(job.currentNa);
      minTotal += loadingCostSeconds;
      maxTotal += loadingCostSeconds;
    }
    minTotal += job.minSeconds;
    maxTotal += job.maxSeconds;

    const color: QueueColor =
      maxTotal <= capacitySeconds
        ? "green"
        : minTotal <= capacitySeconds
          ? "yellow"
          : "orange";

    return { id: job.id, minTotalSeconds: minTotal, maxTotalSeconds: maxTotal, color };
  });
}

export interface ExposureEstimateInput {
  areaUm2: number;
  doseUcCm2: number; // the dose actually used for this submission (user-entered, not necessarily the resist's catalog reference value)
  currentNa: number;
  layerCount: number; // number of exposure layers selected — feeds the per-layer calibration overhead below
  doseMinRatio?: number; // default -0.1 -> -10%
  doseMaxRatio?: number; // default 0.2 -> +20% (PEC dose uncertainty band)
  calibrationSeconds?: number; // default 120 (2 min) — fixed one-time overhead per layout, unaffected by PEC
  perLayerSeconds?: number; // default 30 — added once per exposure layer, unaffected by PEC
}

export interface ExposureEstimate {
  doseUcCm2: number;
  doseMinUcCm2: number;
  doseMaxUcCm2: number;
  timeCalculatedSeconds: number;
  timeMinSeconds: number;
  timeMaxSeconds: number;
}

/**
 * Total time = (area/current/dose-derived write time) + fixed overhead
 * (calibration + per-layer setup). The PEC -10%/+20% band only applies to
 * the dose-derived write time — calibration/setup overhead doesn't scale
 * with dose uncertainty, so it's added identically to calculated/min/max.
 */
export function estimateExposureTime({
  areaUm2,
  doseUcCm2,
  currentNa,
  layerCount,
  doseMinRatio = -0.1,
  doseMaxRatio = 0.2,
  calibrationSeconds = 120,
  perLayerSeconds = 30,
}: ExposureEstimateInput): ExposureEstimate {
  const areaCm2 = areaUm2 * 1e-8;
  const currentUA = currentNa / 1000;
  const doseMinUcCm2 = doseUcCm2 * (1 + doseMinRatio);
  const doseMaxUcCm2 = doseUcCm2 * (1 + doseMaxRatio);
  const overheadSeconds = calibrationSeconds + perLayerSeconds * layerCount;

  return {
    doseUcCm2,
    doseMinUcCm2,
    doseMaxUcCm2,
    timeCalculatedSeconds: (areaCm2 * doseUcCm2) / currentUA + overheadSeconds,
    timeMinSeconds: (areaCm2 * doseMinUcCm2) / currentUA + overheadSeconds,
    timeMaxSeconds: (areaCm2 * doseMaxUcCm2) / currentUA + overheadSeconds,
  };
}
