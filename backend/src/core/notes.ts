import { ulid } from "ulid";
import { getPool } from "./db.js";

// 碎片记录:纯 CRUD,自有数据(设计文档 §2.2/§6)。

export interface Note {
  id: string;
  content: string;
  created_at: string;
  updated_at: string | null;
}

export async function createNote(input: { id?: string; content: string }): Promise<Note> {
  const id = input.id ?? ulid();
  // 同 id 重放返回已存在的那条(离线补发幂等,与 tasks 一致)
  const { rows } = await getPool().query<Note>(
    `INSERT INTO notes (id, content) VALUES ($1, $2)
     ON CONFLICT (id) DO NOTHING
     RETURNING *`,
    [id, input.content],
  );
  if (rows[0]) return rows[0];
  const { rows: existing } = await getPool().query<Note>("SELECT * FROM notes WHERE id = $1", [id]);
  return existing[0]!;
}

export async function listNotes(): Promise<Note[]> {
  const { rows } = await getPool().query<Note>("SELECT * FROM notes ORDER BY created_at DESC");
  return rows;
}

export async function updateNote(id: string, content: string): Promise<Note | null> {
  const { rows } = await getPool().query<Note>(
    "UPDATE notes SET content = $1, updated_at = now() WHERE id = $2 RETURNING *",
    [content, id],
  );
  return rows[0] ?? null;
}

export async function deleteNote(id: string): Promise<boolean> {
  const { rowCount } = await getPool().query("DELETE FROM notes WHERE id = $1", [id]);
  return (rowCount ?? 0) > 0;
}
