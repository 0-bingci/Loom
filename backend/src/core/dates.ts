import { DateTime } from "luxon";
import { config } from "./config.js";

// 所有"今天"与提醒时间都按 UTC+8 计算(设计文档 §3、§5.2)。
// 机器本身可能跑在任何时区,绝不能用 new Date() 直接取"今天"。

/** 现在(UTC+8)。测试可传 nowUtc 固定时刻。 */
export function nowLocal(nowUtc?: DateTime): DateTime {
  return (nowUtc ?? DateTime.utc()).setZone(config.timezone);
}

/** 今天的 'YYYY-MM-DD'(UTC+8)。 */
export function todayLocal(nowUtc?: DateTime): string {
  return nowLocal(nowUtc).toISODate()!;
}

/** 'YYYY-MM-DD' → 周几,'MON'..'SUN'。 */
export function weekdayOf(date: string): string {
  const names = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  return names[DateTime.fromISO(date).weekday - 1]!;
}

/** 'HH:MM' 是否已过:比较当前 UTC+8 的钟表时间。 */
export function timeHasPassed(remindTime: string, nowUtc?: DateTime): boolean {
  return nowLocal(nowUtc).toFormat("HH:mm") >= remindTime;
}
