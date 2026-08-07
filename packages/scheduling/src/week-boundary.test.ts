import { describe, expect, it } from "vitest";
import { currentWeekId, describeWeek, formatWeekLabel, weekFolderName } from "./week-boundary.js";

const WED_8AM_KST: import("./week-boundary.js").CutoverSettings = {
  cutoverDayOfWeek: 3, // Wednesday
  cutoverHour: 8,
  cutoverMinute: 0,
  timezone: "Asia/Seoul",
};

describe("currentWeekId", () => {
  it("returns the most recent Wednesday for a Friday", () => {
    // 2026-07-24T02:00:00Z = 2026-07-24 11:00 KST, a Friday
    const now = new Date("2026-07-24T02:00:00Z");
    expect(currentWeekId(WED_8AM_KST, now)).toBe("2026-07-22");
  });

  it("is inclusive right at the cutover boundary", () => {
    // 2026-07-21T23:00:00Z = 2026-07-22 08:00 KST exactly
    const now = new Date("2026-07-21T23:00:00Z");
    expect(currentWeekId(WED_8AM_KST, now)).toBe("2026-07-22");
  });

  it("rolls back a full week one minute before the boundary", () => {
    // 2026-07-21T22:59:00Z = 2026-07-22 07:59 KST, one minute before cutover
    const now = new Date("2026-07-21T22:59:00Z");
    expect(currentWeekId(WED_8AM_KST, now)).toBe("2026-07-15");
  });
});

describe("describeWeek", () => {
  it("labels the 1st Wednesday of August as 8월 1주차, spanning Wed-Tue", () => {
    expect(describeWeek("2026-08-05")).toEqual({
      monthOfYear: 8,
      weekOfMonth: 1,
      startDate: "2026-08-05",
      endDate: "2026-08-11",
    });
  });

  it("counts the 2nd/3rd occurrence of the same weekday correctly", () => {
    expect(describeWeek("2026-08-12").weekOfMonth).toBe(2);
    expect(describeWeek("2026-08-19").weekOfMonth).toBe(3);
  });

  it("rolls the end date into the next month when the week spans a month boundary", () => {
    expect(describeWeek("2026-07-29")).toEqual({
      monthOfYear: 7,
      weekOfMonth: 5,
      startDate: "2026-07-29",
      endDate: "2026-08-04",
    });
  });
});

describe("formatWeekLabel", () => {
  it("formats as \"n월 m주차(YYYY.MM.DD. ~ YYYY.MM.DD.)\"", () => {
    expect(formatWeekLabel("2026-08-05")).toBe("8월 1주차(2026.08.05. ~ 2026.08.11.)");
  });
});

describe("weekFolderName", () => {
  it("formats as YYMM_weekN", () => {
    expect(weekFolderName("2026-08-05")).toBe("2608_week1");
    expect(weekFolderName("2026-08-12")).toBe("2608_week2");
    expect(weekFolderName("2026-07-29")).toBe("2607_week5");
  });
});
