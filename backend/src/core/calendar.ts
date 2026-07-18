import { getPool } from "./db.js";
import { occursOn } from "./recurrence.js";
import type { Task } from "./types.js";

// 日历投影:任务钉在它"属于"的日期上。
// 与今天视图(dashboard)语义不同:一次性任务只出现在 due_date 当天,不做"逾期追人";
// 循环任务出现在区间内每个匹配日。完成状态照常来自 task_log。

export interface CalendarItem {
  task: Task;
  date: string;
  kind: "once" | "recurring";
  done: boolean;
}

function* eachDay(from: string, to: string): Generator<string> {
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    yield d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

export async function getCalendar(from: string, to: string): Promise<CalendarItem[]> {
  const pool = getPool();
  const { rows: tasks } = await pool.query<Task>("SELECT * FROM tasks WHERE NOT archived");

  const items: Omit<CalendarItem, "done">[] = [];
  for (const t of tasks) {
    if (t.recurrence) {
      for (const day of eachDay(from, to)) {
        if (occursOn(t, day)) items.push({ task: t, date: day, kind: "recurring" });
      }
    } else if (t.due_date && t.due_date >= from && t.due_date <= to) {
      items.push({ task: t, date: t.due_date, kind: "once" });
    }
  }
  if (items.length === 0) return [];

  // 一次查出范围内所有完成状态
  const { rows: logs } = await pool.query<{ task_id: string; date: string; done: boolean }>(
    "SELECT task_id, date::text, done FROM task_log WHERE date BETWEEN $1 AND $2",
    [from, to],
  );
  const doneMap = new Map(logs.map((l) => [`${l.task_id}|${l.date}`, l.done]));

  return items.map((it) => ({ ...it, done: doneMap.get(`${it.task.id}|${it.date}`) ?? false }));
}
