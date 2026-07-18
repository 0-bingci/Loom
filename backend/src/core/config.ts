// 集中读环境变量。API 与 worker 都从这里拿配置,保证两进程看到同一份约定。

function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v !== undefined && v !== "") return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`缺少环境变量 ${name}`);
}

export const config = {
  databaseUrl: env("DATABASE_URL", "postgres://loom:loom@localhost:5432/loom"),
  apiToken: env("LOOM_API_TOKEN", "change-me"),
  apiPort: Number(env("LOOM_API_PORT", "8787")),
  workerIntervalMs: Number(env("LOOM_WORKER_INTERVAL_MS", "60000")),
  // 所有"今天"与 remind_time 均按此时区计算(设计文档 §3)。
  timezone: "Asia/Shanghai", // UTC+8
} as const;
