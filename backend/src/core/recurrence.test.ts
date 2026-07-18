import { describe, expect, it } from "vitest";
import { weekdayOf } from "./dates.js";
import { isValidRecurrence, occursOn, ruleMatches } from "./recurrence.js";

// 2026-07-13 是周一,2026-07-18(今天)是周六。

describe("weekdayOf", () => {
  it("算对星期", () => {
    expect(weekdayOf("2026-07-13")).toBe("MON");
    expect(weekdayOf("2026-07-18")).toBe("SAT");
    expect(weekdayOf("2026-07-19")).toBe("SUN");
  });
});

describe("isValidRecurrence", () => {
  it("接受 daily 与 weekly:...", () => {
    expect(isValidRecurrence("daily")).toBe(true);
    expect(isValidRecurrence("weekly:MON")).toBe(true);
    expect(isValidRecurrence("weekly:MON,WED,FRI")).toBe(true);
  });
  it("拒绝非法形态", () => {
    expect(isValidRecurrence("monthly")).toBe(false);
    expect(isValidRecurrence("weekly:")).toBe(false);
    expect(isValidRecurrence("weekly:MONDAY")).toBe(false);
    expect(isValidRecurrence("")).toBe(false);
  });
});

describe("ruleMatches", () => {
  it("daily 天天匹配", () => {
    expect(ruleMatches("daily", "2026-07-18")).toBe(true);
  });
  it("weekly 只匹配指定星期", () => {
    expect(ruleMatches("weekly:MON,WED", "2026-07-13")).toBe(true); // 周一
    expect(ruleMatches("weekly:MON,WED", "2026-07-15")).toBe(true); // 周三
    expect(ruleMatches("weekly:MON,WED", "2026-07-18")).toBe(false); // 周六
  });
});

describe("occursOn(生效区间,设计文档 §5.1)", () => {
  const base = { recurrence: "daily", start_date: null as string | null, end_date: null as string | null };

  it("无区间 = 永远循环", () => {
    expect(occursOn(base, "2026-07-18")).toBe(true);
  });
  it("start_date 之前不出现", () => {
    expect(occursOn({ ...base, start_date: "2026-07-20" }, "2026-07-18")).toBe(false);
    expect(occursOn({ ...base, start_date: "2026-07-18" }, "2026-07-18")).toBe(true);
  });
  it("end_date 之后自动消失,无需清理", () => {
    expect(occursOn({ ...base, end_date: "2026-07-17" }, "2026-07-18")).toBe(false);
    expect(occursOn({ ...base, end_date: "2026-07-18" }, "2026-07-18")).toBe(true);
  });
  it("非循环任务不匹配", () => {
    expect(occursOn({ recurrence: null, start_date: null, end_date: null }, "2026-07-18")).toBe(false);
  });
});
