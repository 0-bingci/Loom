import { ulid } from "ulid";
import { getPool } from "./db.js";
import type { List } from "./types.js";

// 清单的 CRUD。自有数据,完整增删改查(设计文档 §1.4)。
// 归类维度而已——不碰任务的调度逻辑,只提供"任务归到哪一组"这层。

export interface CreateListInput {
  /** 客户端可自带 ULID:与 tasks/notes 一致,断网补发靠它幂等去重。 */
  id?: string;
  name: string;
  color?: string | null;
}

export interface UpdateListInput {
  name?: string;
  color?: string | null;
  sort_order?: number | null;
  archived?: boolean;
}

/** 清单 + 其下未归档的活跃任务数(侧边栏计数用)。 */
export interface ListWithCount extends List {
  task_count: number;
}

export async function createList(input: CreateListInput): Promise<List> {
  const id = input.id ?? ulid();
  const { rows } = await getPool().query<List>(
    `INSERT INTO lists (id, name, color)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING
     RETURNING *`,
    [id, input.name, input.color ?? null],
  );
  return rows[0] ?? (await getList(id))!;
}

export async function getList(id: string): Promise<List | null> {
  const { rows } = await getPool().query<List>("SELECT * FROM lists WHERE id = $1", [id]);
  return rows[0] ?? null;
}

/** 全部清单 + 计数。未排(sort_order NULL)的按创建时间兜底,排在已排之后。 */
export async function listLists(opts: { includeArchived?: boolean } = {}): Promise<ListWithCount[]> {
  const where = opts.includeArchived ? "" : "WHERE NOT l.archived";
  const { rows } = await getPool().query<ListWithCount>(
    `SELECT l.*,
            COUNT(t.id) FILTER (WHERE t.id IS NOT NULL AND NOT t.archived)::int AS task_count
     FROM lists l
     LEFT JOIN tasks t ON t.list_id = l.id
     ${where}
     GROUP BY l.id
     ORDER BY l.sort_order IS NULL, l.sort_order, l.created_at`,
  );
  return rows;
}

export async function updateList(id: string, input: UpdateListInput): Promise<List | null> {
  // 动态拼 SET:只更新传了的字段(与 tasks.updateTask 同一套写法)。
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    values.push(value);
    fields.push(`${key} = $${values.length}`);
  }
  if (fields.length === 0) return getList(id);
  values.push(id);
  const { rows } = await getPool().query<List>(
    `UPDATE lists SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
    values,
  );
  return rows[0] ?? null;
}

/** 删清单:其下任务不删,靠 FK 的 ON DELETE SET NULL 自动回到"未分类"。 */
export async function deleteList(id: string): Promise<boolean> {
  const { rowCount } = await getPool().query("DELETE FROM lists WHERE id = $1", [id]);
  return (rowCount ?? 0) > 0;
}
