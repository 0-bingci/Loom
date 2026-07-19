import { config } from "./config.js";
import { getPool } from "./db.js";
import { occursOn } from "./recurrence.js";
import type { DashboardItem, Task } from "./types.js";

// Dashboard 是算出来的,不预生成(设计文档 §5.1)。
// 核心原则:一次性任务一直追着你直到做完;循环任务"当天有效",错过不累积。

/**
 * 某天的 dashboard:
 * - 一次性:due_date ≤ date 且未完成(逾期的一直挂着,不被吞掉)
 * - 循环:规则匹配 date 且在生效区间内(某天没做不累积,明天是崭新一条)
 *
 * 单人系统任务量小,直接取全部活跃任务在 app 层算——循环逻辑只存在于一处(recurrence.ts),
 * 不在 SQL 里复制一份。
 */
export async function getDashboard(date: string): Promise<DashboardItem[]> {
  const pool = getPool();
  const { rows: tasks } = await pool.query<Task>("SELECT * FROM tasks WHERE NOT archived");

  // 一次性任务的状态行记在 due_date 上;循环任务记在查询日上。
  const logDateOf = (t: Task) => (t.recurrence ? date : t.due_date!);

  // 收集箱任务(无 due_date 无 recurrence)不属于任何一天,不进日视图
  const candidates = tasks.filter((t) =>
    t.recurrence ? occursOn(t, date) : t.due_date != null && t.due_date <= date,
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
    items.push({
      task: t,
      date: logDateOf(t),
      kind: t.recurrence ? "recurring" : "once",
      overdue: !t.recurrence && t.due_date! < date,
      done,
      done_at: log?.done_at ?? null,
    });
  }

  // 逾期最前;组内按手动排序(未排的靠后,按创建时间)。
  const ord = (x: DashboardItem) => x.task.sort_order ?? Infinity;
  items.sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      ord(a) - ord(b) ||
      (a.task.created_at < b.task.created_at ? -1 : 1),
  );
  return items;
}
