import { ulid } from "ulid";
import { getPool } from "./db.js";
import type { Task } from "./types.js";

// 任务定义的 CRUD。自有数据,完整增删改查(设计文档 §1.4)。

export interface CreateTaskInput {
  /** 客户端可自带 ULID:断网补发时靠它幂等去重(同 id 重放不会建重复任务)。 */
  id?: string;
  title: string;
  due_date?: string | null;
  recurrence?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  remind_time?: string | null;
  note?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  due_date?: string | null;
  recurrence?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  remind_time?: string | null;
  note?: string | null;
  archived?: boolean;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const id = input.id ?? ulid();
  // ON CONFLICT DO NOTHING + 回读:同 id 重放时返回已存在的那条(以先到的为准),不报错不重复。
  const { rows } = await getPool().query<Task>(
    `INSERT INTO tasks (id, title, due_date, recurrence, start_date, end_date, remind_time, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING
     RETURNING *`,
    [
      id,
      input.title,
      input.due_date ?? null,
      input.recurrence ?? null,
      input.start_date ?? null,
      input.end_date ?? null,
      input.remind_time ?? null,
      input.note ?? null,
    ],
  );
  return rows[0] ?? (await getTask(id))!;
}

export async function getTask(id: string): Promise<Task | null> {
  const { rows } = await getPool().query<Task>("SELECT * FROM tasks WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function listTasks(opts: { includeArchived?: boolean } = {}): Promise<Task[]> {
  const sql = opts.includeArchived
    ? "SELECT * FROM tasks ORDER BY created_at DESC"
    : "SELECT * FROM tasks WHERE NOT archived ORDER BY created_at DESC";
  const { rows } = await getPool().query<Task>(sql);
  return rows;
}

export interface TaskWithStatus extends Task {
  /** 仅一次性任务有意义:是否已完成(循环任务的"完成"是按天的,恒为 null) */
  once_done: boolean | null;
  once_done_at: string | null;
}

/** 全量任务 + 一次性任务的完成状态("所有"管理页用)。 */
export async function listTasksWithStatus(
  opts: { includeArchived?: boolean } = {},
): Promise<TaskWithStatus[]> {
  const where = opts.includeArchived ? "" : "WHERE NOT t.archived";
  // LATERAL 取最新一条 log:一次性任务一辈子只有一行;收集箱任务完成时记在完成当天,也能取到。
  const { rows } = await getPool().query<TaskWithStatus>(
    `SELECT t.*,
            CASE WHEN t.recurrence IS NULL THEN COALESCE(l.done, FALSE) END AS once_done,
            l.done_at AS once_done_at
     FROM tasks t
     LEFT JOIN LATERAL (
       SELECT done, done_at FROM task_log WHERE task_id = t.id ORDER BY date DESC LIMIT 1
     ) l ON t.recurrence IS NULL
     ${where}
     ORDER BY t.created_at DESC`,
  );
  return rows;
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<Task | null> {
  // 动态拼 SET 子句:只更新传了的字段。
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    values.push(value);
    fields.push(`${key} = $${values.length}`);
  }
  if (fields.length === 0) return getTask(id);
  values.push(id);
  const { rows } = await getPool().query<Task>(
    `UPDATE tasks SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
    values,
  );
  return rows[0] ?? null;
}

export async function deleteTask(id: string): Promise<boolean> {
  const { rowCount } = await getPool().query("DELETE FROM tasks WHERE id = $1", [id]);
  return (rowCount ?? 0) > 0;
}

/** 标记任务在某天完成/取消完成。task_log 行不存在则建(稀疏表,§4.3)。 */
export async function setTaskDone(taskId: string, date: string, done: boolean): Promise<void> {
  await getPool().query(
    `INSERT INTO task_log (id, task_id, date, done, done_at)
     VALUES ($1, $2, $3, $4, CASE WHEN $4 THEN now() ELSE NULL END)
     ON CONFLICT (task_id, date)
     DO UPDATE SET done = $4, done_at = CASE WHEN $4 THEN now() ELSE NULL END`,
    [ulid(), taskId, date, done],
  );
}
