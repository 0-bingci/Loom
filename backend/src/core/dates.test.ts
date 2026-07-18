import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { timeHasPassed, todayLocal } from "./dates.js";

// 设计文档 §5.2 的坑:worker 若跑在 UTC,"今天"会差一天。这里专测跨日边界。

describe("todayLocal(UTC+8)", () => {
  it("UTC 晚上 = UTC+8 的第二天", () => {
    // UTC 2026-07-18 17:00 = UTC+8 2026-07-19 01:00
    const nowUtc = DateTime.utc(2026, 7, 18, 17, 0);
    expect(todayLocal(nowUtc)).toBe("2026-07-19");
  });
  it("UTC 白天 = UTC+8 同一天", () => {
    const nowUtc = DateTime.utc(2026, 7, 18, 3, 0); // UTC+8 11:00
    expect(todayLocal(nowUtc)).toBe("2026-07-18");
  });
});

describe("timeHasPassed(按 UTC+8 钟表时间)", () => {
  it("到点前 false,到点及之后 true", () => {
    const at0859 = DateTime.utc(2026, 7, 18, 0, 59); // UTC+8 08:59
    const at0900 = DateTime.utc(2026, 7, 18, 1, 0); // UTC+8 09:00
    expect(timeHasPassed("09:00", at0859)).toBe(false);
    expect(timeHasPassed("09:00", at0900)).toBe(true);
  });
});
