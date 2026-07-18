import { weekdayOf } from "./dates.js";

// 循环规则 v1:只支持 'daily' 和 'weekly:MON,WED'。别的形态等真需要再加。

const WEEKDAYS = new Set(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);

/** 校验 recurrence 字符串是否合法(建任务时用)。 */
export function isValidRecurrence(rule: string): boolean {
  if (rule === "daily") return true;
  if (rule.startsWith("weekly:")) {
    const days = rule.slice("weekly:".length).split(",");
    return days.length > 0 && days.every((d) => WEEKDAYS.has(d));
  }
  return false;
}

/** 循环规则在某天是否匹配(只看星期规则,不看生效区间)。 */
export function ruleMatches(rule: string, date: string): boolean {
  if (rule === "daily") return true;
  if (rule.startsWith("weekly:")) {
    return rule.slice("weekly:".length).split(",").includes(weekdayOf(date));
  }
  return false;
}

/**
 * 循环任务在某天是否"该出现":规则匹配 + 在生效区间内(设计文档 §5.1)。
 * start_date 为空 = 不限起点;end_date 为空 = 永远循环。
 */
export function occursOn(
  task: { recurrence: string | null; start_date: string | null; end_date: string | null },
  date: string,
): boolean {
  if (!task.recurrence) return false;
  if (task.start_date && date < task.start_date) return false;
  if (task.end_date && date > task.end_date) return false;
  return ruleMatches(task.recurrence, date);
}
