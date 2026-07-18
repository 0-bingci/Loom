import { DateTime } from "luxon";
import { ulid } from "ulid";
import { timeHasPassed, todayLocal } from "./dates.js";
import { getPool } from "./db.js";
import { occursOn } from "./recurrence.js";
import type { Task } from "./types.js";

// 提醒循环的判定 + 落库(设计文档 §5.2)。worker 每分钟调一次 runReminderSweep。
//
// 状态行的日期约定(与 dashboard 一致):
// - 循环任务:记在"今天"——日期天然按天去重,明天没有 log 行,自动又能提醒。
// - 一次性任务:记在 due_date 上(§4.3:一辈子只会有一行)——一共只提醒一次,
//   哪怕逾期多日未做,也不会每天轰炸。

export interface SweepResult {
  date: string;
  created: number; // 本轮生成了几条通知
}

export async function runReminderSweep(nowUtc?: DateTime): Promise<SweepResult> {
  const today = todayLocal(nowUtc);
  const pool = getPool();

  const { rows: tasks } = await pool.query<Task>(
    "SELECT * FROM tasks WHERE NOT archived AND remind_time IS NOT NULL",
  );

  let created = 0;
  for (const t of tasks) {
    // 1. 今天该出现(收集箱任务没有"哪天",永不提醒)
    const dueToday = t.recurrence ? occursOn(t, today) : t.due_date != null && t.due_date <= today;
    if (!dueToday) continue;
    // 2. remind_time 已过
    if (!timeHasPassed(t.remind_time!, nowUtc)) continue;

    const logDate = t.recurrence ? today : t.due_date!;

    // 3+4. 这条还没 notified、也还没完成 —— 查、写放在一个事务里,
    // 生成 notification 和标 notified 要么都发生要么都不发生(否则会重复轰炸或丢提醒)。
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows: logRows } = await client.query<{ done: boolean; notified: boolean }>(
        "SELECT done, notified FROM task_log WHERE task_id = $1 AND date = $2 FOR UPDATE",
        [t.id, logDate],
      );
      const log = logRows[0];
      if (log?.notified || log?.done) {
        await client.query("ROLLBACK");
        continue;
      }
      await client.query(
        `INSERT INTO notifications (id, task_id, date) VALUES ($1, $2, $3)
         ON CONFLICT (task_id, date) DO NOTHING`,
        [ulid(), t.id, logDate],
      );
      await client.query(
        `INSERT INTO task_log (id, task_id, date, notified) VALUES ($1, $2, $3, TRUE)
         ON CONFLICT (task_id, date) DO UPDATE SET notified = TRUE`,
        [ulid(), t.id, logDate],
      );
      await client.query("COMMIT");
      created++;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  return { date: today, created };
}
