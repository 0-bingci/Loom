-- 任务备注:任务定义上的自由文本(详情面板里那个"写点什么")。
-- 注意与 notes 表(碎片记录)无关:这个是挂在某条任务上的备注。
ALTER TABLE tasks ADD COLUMN note TEXT;
