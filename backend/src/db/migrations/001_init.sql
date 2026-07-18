-- loom v1 初始 schema(Postgres)
-- 约定:date/time 列在 app 层按 UTC+8 计算好再存;timestamptz 存真实时刻。

-- 任务定义:一条定义永远只有一行,不管循环多少天。
CREATE TABLE tasks (
  id          TEXT PRIMARY KEY,            -- ULID
  title       TEXT NOT NULL,
  due_date    DATE,                        -- 一次性任务用;循环任务留空
  recurrence  TEXT,                        -- 循环任务用,如 'daily' / 'weekly:MON,WED'
  start_date  DATE,                        -- 循环生效起始日;留空 = 不限起点
  end_date    DATE,                        -- 循环生效截止日;留空 = 永远循环
  remind_time TIME,                        -- 几点提醒(UTC+8 的钟表时间)
  archived    BOOLEAN NOT NULL DEFAULT FALSE, -- 定义是否仍生效
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 一条任务要么一次性(有 due_date)、要么循环(有 recurrence),不能两者都空。
  CHECK (due_date IS NOT NULL OR recurrence IS NOT NULL)
);

CREATE INDEX idx_tasks_active ON tasks (archived);

-- 每日状态(稀疏表):记"某任务在某天发生了什么"。
-- 没有对应行 = 那天还没做、也还没提醒过。一次性任务一辈子只会有一行。
CREATE TABLE task_log (
  id       TEXT PRIMARY KEY,               -- ULID
  task_id  TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  date     DATE NOT NULL,
  done     BOOLEAN NOT NULL DEFAULT FALSE, -- 当天是否完成
  done_at  TIMESTAMPTZ,
  notified BOOLEAN NOT NULL DEFAULT FALSE, -- 当天是否已生成过提醒

  UNIQUE (task_id, date)
);

-- 待呈现的提醒:两个世界的交汇点。
-- 相对设计文档加了 date 字段:循环任务的提醒是按天的,同一 task_id 会在不同日期各生成一条。
CREATE TABLE notifications (
  id         TEXT PRIMARY KEY,             -- ULID
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  date       DATE NOT NULL,                -- 这条提醒对应的日期
  status     TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at    TIMESTAMPTZ,

  CHECK (status IN ('pending', 'read')),
  -- 同一任务同一天只会有一条提醒(worker 靠 task_log.notified 去重,这里再兜底一层)。
  UNIQUE (task_id, date)
);

CREATE INDEX idx_notifications_status ON notifications (status);
