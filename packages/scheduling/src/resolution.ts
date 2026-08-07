export interface PixelResolutionInput {
  doseUcCm2: number;
  currentNa: number;
  minDwellNs?: number; // default 8 — equipment spec floor: dwell time per pixel can't go below this
  dwellMarginRatio?: number; // default 0.2 — safety margin for PEC's local dose range, applied to the dwell floor
  stepUnitNm?: number; // default 0.5 — step size is a natural number of these units
}

export interface PixelResolution {
  stepSize: number; // natural number of stepUnitNm units — the minimum allowed (can't go finer without violating the dwell floor)
  pixelSizeNm: number; // stepSize * stepUnitNm
}

/**
 * Minimum pixel size (= resolution) the equipment allows for a given dose
 * and current, derived from the dwell-time floor.
 *
 * Dwell time per pixel: t[s] = charge[C] / current[A] = (dose * area) / current.
 * Converting units (dose in µC/cm², area in nm², current in nA, t in ns):
 *   1 µC/cm² = 1e-6 C / 1e14 nm² = 1e-20 C/nm²; 1 nA = 1e-9 A
 *   t[s] = dose * 1e-20 * area / (current * 1e-9) = dose*area/current * 1e-11
 *   t[ns] = t[s] * 1e9 = dose*area/current * 1e-2
 * So t[ns] = 0.01 * dose[µC/cm²] * area[nm²] / current[nA].
 *
 * Requiring t[ns] >= minDwellNs*(1+dwellMarginRatio) and solving for area
 * gives the minimum pixel area; its square root is the minimum resolution,
 * which then gets rounded up to the nearest whole step (stepUnitNm each).
 */
export function computeMinPixelResolution({
  doseUcCm2,
  currentNa,
  minDwellNs = 8,
  dwellMarginRatio = 0.2,
  stepUnitNm = 0.5,
}: PixelResolutionInput): PixelResolution {
  const requiredDwellNs = minDwellNs * (1 + dwellMarginRatio);
  const NS_PER_UCCM2_NM2_PER_NA = 0.01;
  const areaMinNm2 = (requiredDwellNs * currentNa) / (NS_PER_UCCM2_NM2_PER_NA * doseUcCm2);
  const resolutionMinNm = Math.sqrt(areaMinNm2);
  const stepSize = Math.ceil(resolutionMinNm / stepUnitNm);
  return {
    stepSize,
    pixelSizeNm: stepSize * stepUnitNm,
  };
}
