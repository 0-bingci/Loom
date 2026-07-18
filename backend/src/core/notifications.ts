import { getPool } from "./db.js";
import type { Notification } from "./types.js";

// 通知的读侧:客户端纯拉取(设计文档 §5.4)。生命周期 pending → read(§5.3)。

export async function listNotifications(status?: "pending" | "read"): Promise<Notification[]> {
  const { rows } = status
    ? await getPool().query<Notification>(
        "SELECT id, task_id, date::text, status, created_at, read_at FROM notifications WHERE status = $1 ORDER BY created_at DESC",
        [status],
      )
    : await getPool().query<Notification>(
        "SELECT id, task_id, date::text, status, created_at, read_at FROM notifications ORDER BY created_at DESC",
      );
  return rows;
}

export async function markNotificationRead(id: string): Promise<Notification | null> {
  const { rows } = await getPool().query<Notification>(
    `UPDATE notifications SET status = 'read', read_at = now()
     WHERE id = $1 AND status = 'pending'
     RETURNING id, task_id, date::text, status, created_at, read_at`,
    [id],
  );
  return rows[0] ?? null;
}
