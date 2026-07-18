import { config } from "../core/config.js";
import { closePool } from "../core/db.js";
import { runReminderSweep } from "../core/reminders.js";

// 主动世界:每分钟醒来扫一遍,到点的任务生成通知(设计文档 §5.2)。
// 状态全在数据库,重启不丢;轮询比内存定时任务笨,但对个人系统最稳。

let running = false;

async function tick(): Promise<void> {
  if (running) return; // 上一轮还没跑完就跳过,不叠加
  running = true;
  try {
    const result = await runReminderSweep();
    if (result.created > 0) {
      console.log(`[worker] ${new Date().toISOString()} ${result.date} 生成 ${result.created} 条提醒`);
    }
  } catch (e) {
    // 单轮失败只记日志,不退出——下一分钟再试,数据库里的状态保证不会重复提醒。
    console.error("[worker] 本轮扫描失败:", e);
  } finally {
    running = false;
  }
}

console.log(`[worker] 启动,轮询间隔 ${config.workerIntervalMs}ms`);
void tick(); // 启动先跑一轮,不等第一个间隔
const timer = setInterval(tick, config.workerIntervalMs);

async function shutdown(): Promise<void> {
  clearInterval(timer);
  await closePool();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
