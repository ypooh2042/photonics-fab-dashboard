import { describe, expect, it } from "vitest";
import { computeMinPixelResolution } from "./resolution.js";

describe("computeMinPixelResolution", () => {
  it("matches the worked example: 240 uC/cm2 @ 2nA -> step size 6 (3nm pixel)", () => {
    const result = computeMinPixelResolution({ doseUcCm2: 240, currentNa: 2 });
    expect(result.stepSize).toBe(6);
    expect(result.pixelSizeNm).toBe(3);
  });

  it("requires a coarser (larger) pixel at higher current for the same dose", () => {
    const low = computeMinPixelResolution({ doseUcCm2: 240, currentNa: 2 });
    const high = computeMinPixelResolution({ doseUcCm2: 240, currentNa: 5 });
    expect(high.pixelSizeNm).toBeGreaterThan(low.pixelSizeNm);
  });

  it("requires a finer (smaller) pixel at higher dose for the same current", () => {
    const lowDose = computeMinPixelResolution({ doseUcCm2: 240, currentNa: 2 });
    const highDose = computeMinPixelResolution({ doseUcCm2: 480, currentNa: 2 });
    expect(highDose.pixelSizeNm).toBeLessThan(lowDose.pixelSizeNm);
  });

  it("rounds the step size up to the nearest whole 0.5nm step", () => {
    // Pick dose/current where the raw resolution isn't a clean multiple of 0.5nm.
    const result = computeMinPixelResolution({ doseUcCm2: 240, currentNa: 5 });
    expect(Number.isInteger(result.stepSize)).toBe(true);
    expect(result.pixelSizeNm).toBeCloseTo(result.stepSize * 0.5, 10);
  });
});
