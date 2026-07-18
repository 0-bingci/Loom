// 日期/循环规则的中文展示(纯函数,原型里的文案形态)

const WD = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const WD_MAP: Record<string, string> = {
  MON: "周一", TUE: "周二", WED: "周三", THU: "周四", FRI: "周五", SAT: "周六", SUN: "周日",
};

const parse = (d: string) => new Date(`${d}T00:00:00+08:00`);

/** '2026-07-17' → '7 月 17 日' */
export function fmtDate(d: string): string {
  const t = parse(d);
  return `${t.getMonth() + 1} 月 ${t.getDate()} 日`;
}

/** '2026-07-19' → '周日' */
export function weekday(d: string): string {
  return WD[parse(d).getDay()]!;
}

/** 逾期天数(today、due 均为 'YYYY-MM-DD') */
export function overdueDays(due: string, today: string): number {
  return Math.round((parse(today).getTime() - parse(due).getTime()) / 86400e3);
}

/** 'daily' → '每日';'weekly:MON,WED' → '每周 周一、周三' */
export function fmtRecurrence(rule: string): string {
  if (rule === "daily") return "每日";
  if (rule.startsWith("weekly:")) {
    const days = rule.slice("weekly:".length).split(",").map((d) => WD_MAP[d] ?? d);
    return `每周 ${days.join("、")}`;
  }
  return rule;
}

/** 生效区间:'7 月 1 日 – 7 月 31 日'(单边则只显示有的一边) */
export function fmtWindow(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  if (start && end) return `${fmtDate(start)} – ${fmtDate(end)}`;
  return start ? `${fmtDate(start)} 起` : `至 ${fmtDate(end!)}`;
}
