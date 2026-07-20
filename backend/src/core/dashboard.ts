import { DateTime } from "luxon";
import { config } from "./config.js";
import { getPool } from "./db.js";
import { occursOn } from "./recurrence.js";
import type { DashboardItem, Task } from "./types.js";

// Dashboard 是算出来的,不预生成(设计文档 §5.1)。
// 核心原则:一次性任务一直追着你直到做完;循环任务"当天有效",错过不累积。
//
// 一次性任务两条日期各司其职:
//   due_date  = 死线(硬约束)
//   plan_date = 你打算哪天做(可选、随时改)
// 分流(相对查询日 date):
//   逾期     due_date < date 且没做完      → 顶部,继续追着你
//   今天截止 due_date == date              → 顶部(死线就是今天)
//   今天做   plan_date <= date             → 主列表(排过没做的滚到今天继续追)
//   临近死线 due_date > date 且还没排       → 浮在下方,按剩余天数排序;"多近算近"由前端设置决定
//   收集箱   无 due_date 无 plan_date       → 不属于任何一天,不进日视图

/** 两个 'YYYY-MM-DD' 相差几天(b - a),按 UTC+8 的日历日算。 */
function daysBetween(a: string, b: string): number {
  const start = DateTime.fromISO(a, { zone: config.timezone }).startOf("day");
  const end = DateTime.fromISO(b, { zone: config.timezone }).startOf("day");
  return Math.round(end.diff(start, "days").days);
}

/**
 * 某天的 dashboard。单人系统任务量小,直接取全部活跃任务在 app 层算——
 * 循环逻辑只存在于一处(recurrence.ts),不在 SQL 里复制一份。
 */
export async function getDashboard(date: string): Promise<DashboardItem[]> {
  const pool = getPool();
  const { rows: tasks } = await pool.query<Task>("SELECT * FROM tasks WHERE NOT archived");

  // 一次性任务的完成状态记在 due_date(有死线)或 plan_date(只排期没死线)上;循环记在查询日。
  const logDateOf = (t: Task) => (t.recurrence ? date : (t.due_date ?? t.plan_date)!);

  // 分类:决定一次性任务落在哪个带,以及是否进本日视图。
  const classify = (t: Task) => {
    const due = t.due_date;
    const plan = t.plan_date;
    const overdue = due != null && due < date;
    const dueToday = due === date;
    const plannedForDay = plan != null && plan <= date; // 今天或排过没做(滚到今天)
    const upcoming = due != null && due > date && !plannedForDay; // 未来死线、还没排到今天前
    return { overdue, dueToday, plannedForDay, upcoming, show: overdue || dueToday || plannedForDay || upcoming };
  };

  const candidates = tasks.filter((t) =>
    t.recurrence ? occursOn(t, date) : classify(t).show,
  );
  if (candidates.length === 0) return [];

  // 一把取出所有相关 (task_id, date) 的状态(done_date = 完成时刻换算到 UTC+8 的日期)。
  const { rows: logs } = await pool.query<{
    task_id: string;
    date: string;
    done: boolean;
    done_at: string | null;
    done_date: string | null;
  }>(
    `SELECT task_id, date::text, done, done_at,
            to_char(done_at AT TIME ZONE $3, 'YYYY-MM-DD') AS done_date
     FROM task_log
     WHERE (task_id, date) IN (SELECT unnest($1::text[]), unnest($2::date[]))`,
    [candidates.map((t) => t.id), candidates.map(logDateOf), config.timezone],
  );
  const logMap = new Map(logs.map((l) => [`${l.task_id}|${l.date}`, l]));

  const items: DashboardItem[] = [];
  for (const t of candidates) {
    const log = logMap.get(`${t.id}|${logDateOf(t)}`);
    const done = log?.done ?? false;
    // 一次性任务:完成"当天"仍显示(误点可就地撤销),之后才不再出现。
    if (!t.recurrence && done && log?.done_date !== date) continue;
    const c = t.recurrence
      ? { overdue: false, dueToday: false, upcoming: false }
      : classify(t);
    items.push({
      task: t,
      date: logDateOf(t),
      kind: t.recurrence ? "recurring" : "once",
      overdue: c.overdue,
      due_today: c.dueToday,
      upcoming: c.upcoming,
      days_left: c.upcoming ? daysBetween(date, t.due_date!) : null,
      done,
      done_at: log?.done_at ?? null,
    });
  }

  // 带序:逾期 → 今天截止 → 今天 → 临近死线。带内:临近按剩余天数升序;其余按手动排序(未排靠后,按创建时间)。
  const band = (x: DashboardItem) =>
    x.overdue ? 0 : x.due_today ? 1 : x.upcoming ? 3 : 2;
  const ord = (x: DashboardItem) => x.task.sort_order ?? Infinity;
  items.sort(
    (a, b) =>
      band(a) - band(b) ||
      (a.upcoming ? a.days_left! - b.days_left! : 0) ||
      ord(a) - ord(b) ||
      (a.task.created_at < b.task.created_at ? -1 : 1),
  );
  return items;
}
