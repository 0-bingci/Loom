// 发件箱:保存先发生在本地,同步是后台的事。
// 断网时写操作进 localStorage 队列,恢复后按序补发;创建带客户端 ULID,服务端幂等去重。

import { getToken } from "./api";
import type { DashboardItem, Notification } from "../types";

export interface Op {
  method: string;
  path: string;
  body?: unknown;
}

const QUEUE_KEY = "loom_outbox";
const SNAP_KEY = "loom_snap";

const load = <T>(key: string, fb: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fb;
  } catch {
    return fb;
  }
};

export const queueLength = () => load<Op[]>(QUEUE_KEY, []).length;

export function enqueue(op: Op): number {
  const q = load<Op[]>(QUEUE_KEY, []);
  q.push(op);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  return q.length;
}

/**
 * 直发或入队。"queued" = 没送达:网络不通(fetch 抛 TypeError),
 * 或 5xx(反向代理活着但后端挂了,如 vite 代理/nginx 返回 502)。
 * 重试是安全的:创建带 ULID 幂等,done/read 天然幂等。
 * 401 是配置错,抛给上层;其余 4xx 算送达(重发也不会变对)。
 */
export async function sendOrQueue(op: Op): Promise<"sent" | "queued"> {
  try {
    const res = await fetch(op.path, {
      method: op.method,
      headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
      body: op.body === undefined ? undefined : JSON.stringify(op.body),
    });
    if (res.status === 401) throw Object.assign(new Error("unauthorized"), { name: "AuthError" });
    if (res.status >= 500) {
      enqueue(op);
      return "queued";
    }
    return "sent";
  } catch (e) {
    if ((e as Error).name === "AuthError") throw e;
    enqueue(op);
    return "queued";
  }
}

/** 补发整个队列。4xx 是脏数据:丢弃并告警,不能堵死后面的操作。返回剩余条数。 */
export async function flushQueue(): Promise<number> {
  let q = load<Op[]>(QUEUE_KEY, []);
  while (q.length > 0) {
    const op = q[0]!;
    let res: Response;
    try {
      res = await fetch(op.path, {
        method: op.method,
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: op.body === undefined ? undefined : JSON.stringify(op.body),
      });
    } catch {
      break; // 还是断着,下次再试
    }
    if (res.status >= 500) break; // 后端还没起来(经代理是 5xx),下次再试
    if (!res.ok && res.status !== 404) console.warn("outbox 丢弃失败操作", op, res.status);
    q = q.slice(1);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  }
  return q.length;
}

// ── 快照:最后一次成功拉到的数据,离线时渲染它 ──

export interface Snapshot {
  date: string;
  items: DashboardItem[];
  notifs: Notification[];
}

export const saveSnapshot = (snap: Snapshot) => localStorage.setItem(SNAP_KEY, JSON.stringify(snap));
export const loadSnapshot = (): Snapshot | null => load<Snapshot | null>(SNAP_KEY, null);
