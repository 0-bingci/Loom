-- 清单:把任务归类到命名分组(如"工作""生活""读书")。
-- 与任务的"类型(一次性/循环/收集箱)"和"状态"正交——清单只管归类,
-- 不参与调度、也不影响任何按日视图的算法(dashboard/calendar 照旧)。
CREATE TABLE lists (
  id         TEXT PRIMARY KEY,               -- ULID
  name       TEXT NOT NULL,
  color      TEXT,                           -- 可空,前端色标(如 '#1F7A6B')
  sort_order INTEGER,                        -- 手动排序;NULL = 未排,按创建时间兜底
  archived   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 任务归属某清单;NULL = 未分类。
-- ON DELETE SET NULL:删清单不删任务,任务只是回到"未分类",不会连带丢数据。
ALTER TABLE tasks ADD COLUMN list_id TEXT REFERENCES lists(id) ON DELETE SET NULL;
CREATE INDEX idx_tasks_list ON tasks (list_id);
