import pg from "pg";
import { config } from "./config.js";

// pg 默认把 DATE/TIME 解析成 JS Date(还按本机时区),会把 'YYYY-MM-DD' 弄错位。
// 我们所有日期计算都在 app 层用 Luxon 按 UTC+8 做,数据库只存/取纯字符串。
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v); // 'YYYY-MM-DD'
pg.types.setTypeParser(pg.types.builtins.TIME, (v) => v.slice(0, 5)); // 'HH:MM'

// 单进程内共享一个连接池。API 与 worker 是两个进程,各自一个池、连同一个库。
let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) return pool;
  pool = new pg.Pool({ connectionString: config.databaseUrl, max: 5 });
  return pool;
}

// 主要给测试用:指向测试库。
export function setPool(p: pg.Pool): void {
  pool = p;
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = null;
}
