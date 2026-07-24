-- 回退清单功能:撤销 010 建的结构。
-- 010 已在各环境跑过、留在迁移历史里(不删已应用的迁移),此处加一条反向迁移前滚撤销它。
-- IF EXISTS:在从未跑过 010 的新库上也安全(什么都不做,不报错)。
ALTER TABLE tasks DROP COLUMN IF EXISTS list_id; -- 连带索引 idx_tasks_list、外键约束一并消失
DROP TABLE IF EXISTS lists;
