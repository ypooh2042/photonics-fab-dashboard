import { describe, expect, it } from "vitest";
import { estimateExposureTime, scheduleWeek, type Job } from "./fcfs.js";

describe("scheduleWeek", () => {
  it("colors everything green when well under capacity", () => {
    const jobs: Job[] = [
      { id: 1, submittedAt: "2026-07-20T09:00:00Z", currentNa: 2, minSeconds: 600, maxSeconds: 1200 },
      { id: 2, submittedAt: "2026-07-20T10:00:00Z", currentNa: 2, minSeconds: 600, maxSeconds: 1200 },
    ];
    // capacity 2h = 7200s. loading 30min=1800s charged once for current=2.
    // job1: min=1800+600=2400, max=1800+1200=3000 -> green
    // job2: min=2400+600=3000, max=3000+1200=4200 -> green
    const result = scheduleWeek(jobs, 2, 30);
    expect(result[0].color).toBe("green");
    expect(result[1].color).toBe("green");
    expect(result[0].minTotalSeconds).toBe(2400);
    expect(result[1].maxTotalSeconds).toBe(4200);
  });

  it("charges loading cost once per distinct current, not per job", () => {
    const jobs: Job[] = [
      { id: 1, submittedAt: "2026-07-20T09:00:00Z", currentNa: 2, minSeconds: 100, maxSeconds: 100 },
      { id: 2, submittedAt: "2026-07-20T10:00:00Z", currentNa: 2, minSeconds: 100, maxSeconds: 100 },
      { id: 3, submittedAt: "2026-07-20T11:00:00Z", currentNa: 10, minSeconds: 100, maxSeconds: 100 },
    ];
    const result = scheduleWeek(jobs, 10, 30);
    // job1 (current 2, first time): 1800+100=1900
    // job2 (current 2, repeat): +100 => 2000
    // job3 (current 10, first time): +1800+100 => 3900
    expect(result[0].maxTotalSeconds).toBe(1900);
    expect(result[1].maxTotalSeconds).toBe(2000);
    expect(result[2].maxTotalSeconds).toBe(3900);
  });

  it("turns yellow when max exceeds capacity but min still fits", () => {
    const jobs: Job[] = [
      { id: 1, submittedAt: "2026-07-20T09:00:00Z", currentNa: 2, minSeconds: 3000, maxSeconds: 6000 },
    ];
    // capacity 2h=7200s. min total = 1800+3000=4800 (<=7200) max=1800+6000=7800 (>7200) -> yellow
    const result = scheduleWeek(jobs, 2, 30);
    expect(result[0].color).toBe("yellow");
  });

  it("turns orange once min itself exceeds capacity, and keeps orange for later FCFS entries", () => {
    const jobs: Job[] = [
      { id: 1, submittedAt: "2026-07-20T09:00:00Z", currentNa: 2, minSeconds: 6000, maxSeconds: 6000 },
      { id: 2, submittedAt: "2026-07-20T10:00:00Z", currentNa: 2, minSeconds: 100, maxSeconds: 100 },
    ];
    // job1: min=1800+6000=7800 > 7200 -> orange
    // job2 (submitted later, same current so no extra loading): min=7800+100=7900 -> still orange
    const result = scheduleWeek(jobs, 2, 30);
    expect(result[0].color).toBe("orange");
    expect(result[1].color).toBe("orange");
  });

  it("colors strictly by submission order regardless of current grouping", () => {
    // job A (current 5) submitted first, job B (current 2) submitted second.
    // Even though physical execution might batch by current, coloring must
    // follow FCFS submission order, not current grouping.
    const jobs: Job[] = [
      { id: 1, submittedAt: "2026-07-20T09:00:00Z", currentNa: 5, minSeconds: 100, maxSeconds: 100 },
      { id: 2, submittedAt: "2026-07-20T08:00:00Z", currentNa: 2, minSeconds: 100, maxSeconds: 100 },
    ];
    const result = scheduleWeek(jobs, 1, 30);
    // sorted by submittedAt: job2 (08:00) first, then job1 (09:00)
    expect(result[0].id).toBe(2);
    expect(result[1].id).toBe(1);
  });
});

describe("estimateExposureTime", () => {
  it("computes calculated/min/max time from a -10%/+20% dose band, plus default overhead", () => {
    // area 1 cm^2 = 1e8 um^2, dose 240 uC/cm^2, current 2000nA=2uA, 1 layer
    const result = estimateExposureTime({
      areaUm2: 1e8,
      doseUcCm2: 240,
      currentNa: 2000,
      layerCount: 1,
    });
    expect(result.doseUcCm2).toBe(240);
    expect(result.doseMinUcCm2).toBe(216);
    expect(result.doseMaxUcCm2).toBe(288);
    // base write time = area_cm2 * dose / current_uA = 1*240/2=120s, 1*216/2=108s, 1*288/2=144s
    // default overhead = 120s calibration + 30s * 1 layer = 150s
    expect(result.timeCalculatedSeconds).toBeCloseTo(120 + 150);
    expect(result.timeMinSeconds).toBeCloseTo(108 + 150);
    expect(result.timeMaxSeconds).toBeCloseTo(144 + 150);
  });

  it("adds 30s per exposure layer on top of the fixed calibration overhead", () => {
    const oneLayer = estimateExposureTime({ areaUm2: 0, doseUcCm2: 240, currentNa: 2000, layerCount: 1 });
    const threeLayers = estimateExposureTime({ areaUm2: 0, doseUcCm2: 240, currentNa: 2000, layerCount: 3 });
    // area=0 isolates the overhead term entirely
    expect(oneLayer.timeCalculatedSeconds).toBeCloseTo(120 + 30 * 1);
    expect(threeLayers.timeCalculatedSeconds).toBeCloseTo(120 + 30 * 3);
  });

  it("does not scale the fixed overhead by the PEC dose band", () => {
    const result = estimateExposureTime({ areaUm2: 0, doseUcCm2: 240, currentNa: 2000, layerCount: 2 });
    const overhead = 120 + 30 * 2;
    // area=0 -> base write time is 0 for calculated/min/max alike, so all three should equal the overhead exactly
    expect(result.timeCalculatedSeconds).toBeCloseTo(overhead);
    expect(result.timeMinSeconds).toBeCloseTo(overhead);
    expect(result.timeMaxSeconds).toBeCloseTo(overhead);
  });

  it("supports custom calibration/per-layer overhead overrides", () => {
    const result = estimateExposureTime({
      areaUm2: 0,
      doseUcCm2: 240,
      currentNa: 2000,
      layerCount: 2,
      calibrationSeconds: 60,
      perLayerSeconds: 10,
    });
    expect(result.timeCalculatedSeconds).toBeCloseTo(60 + 10 * 2);
  });
});
